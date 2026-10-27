const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logAction } = require('../utils/auditLog');
const { validateNewAccount, validatePassword } = require('../utils/validateAccount');
require('dotenv').config();

// Compared against when the email doesn't exist, so "unknown email" and "wrong
// password" take about the same time and can't be told apart by timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// POST /api/auth/register  (Admin only - see routes/authRoutes.js)
// There is no public self-signup: an Admin creates every account. The very
// first Admin is created on the web app's one-time setup page (see setupController.js).
async function register(req, res) {
  try {
    const { full_name, email, password, role_name, botanist_type } = req.body;

    const invalid = validateNewAccount(req.body);
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    // Look up role_id from role_name
    const { rows: roleRows } = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [role_name]);
    if (roleRows.length === 0) {
      return res.status(400).json({ error: 'Invalid role_name' });
    }
    const role_id = roleRows[0].role_id;

    // Check email not already used (case-insensitive, matching the unique index)
    const { rows: existing } = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { rows: [created] } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role_id, botanist_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id`,
      [full_name.trim(), email.trim(), password_hash, role_id, botanist_type || null]
    );

    await logAction({
      user_id: req.user.user_id,
      action: 'CREATE_USER',
      target_table: 'users',
      target_id: created.user_id,
      details: { role_name, botanist_type: botanist_type || null }
    });

    res.status(201).json({ message: 'User created', user_id: created.user_id });
  } catch (err) {
    // Unique-index violation: same email registered at the same moment
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'email and password must be text' });
    }

    const { rows } = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active,
              u.botanist_type, r.role_id, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Checked only after the password, so a deactivated account isn't revealed
    // to someone who doesn't know the password.
    if (!user.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    const tokenPayload = {
      user_id: user.user_id,
      role_id: user.role_id,
      role_name: user.role_name,
      botanist_type: user.botanist_type
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    await logAction({ user_id: user.user_id, action: 'LOGIN' });

    res.json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role_name: user.role_name,
        botanist_type: user.botanist_type
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
}

// GET /api/auth/me  (any logged-in user)
// Lets an app that kept a token (e.g. after a page reload) check it is still
// valid and get the current name/role. The role is read fresh from the database.
async function me(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.botanist_type, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Account is no longer active' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while loading your account' });
  }
}

// PATCH /api/auth/password  (any logged-in user)
// Body: { current_password, new_password }
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    const invalid = validatePassword(new_password);
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }
    if (current_password === new_password) {
      return res.status(400).json({ error: 'The new password must be different from the current one' });
    }

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [req.user.user_id]);
    if (rows.length === 0 || !(await bcrypt.compare(current_password, rows[0].password_hash))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [password_hash, req.user.user_id]);
    await logAction({ user_id: req.user.user_id, action: 'CHANGE_PASSWORD', target_table: 'users', target_id: req.user.user_id });

    res.json({ message: 'Password changed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while changing the password' });
  }
}

module.exports = { register, login, me, changePassword };
