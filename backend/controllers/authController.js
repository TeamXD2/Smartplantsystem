const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logAction } = require('../utils/auditLog');
require('dotenv').config();

// POST /api/auth/register
// Note: in practice this should usually be called by an Admin creating
// accounts for Botanists/Officers, not public self-signup. For Sprint 1
// it's left open so the team can create test accounts easily.
async function register(req, res) {
  try {
    const { full_name, email, password, role_name, botanist_type } = req.body;

    if (!full_name || !email || !password || !role_name) {
      return res.status(400).json({ error: 'full_name, email, password, and role_name are required' });
    }

    // Look up role_id from role_name
    const [roleRows] = await pool.query('SELECT role_id FROM roles WHERE role_name = ?', [role_name]);
    if (roleRows.length === 0) {
      return res.status(400).json({ error: 'Invalid role_name' });
    }
    const role_id = roleRows[0].role_id;

    // Check email not already used
    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role_id, botanist_type)
       VALUES (?, ?, ?, ?, ?)`,
      [full_name, email, password_hash, role_id, botanist_type || null]
    );

    await logAction({
      user_id: req.user ? req.user.user_id : null, // null if this is public self-registration
      action: 'CREATE_USER',
      target_table: 'users',
      target_id: result.insertId,
      details: { role_name, botanist_type: botanist_type || null }
    });

    res.status(201).json({ message: 'User created', user_id: result.insertId });
  } catch (err) {
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

    const [rows] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active,
              u.botanist_type, r.role_id, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokenPayload = {
      user_id: user.user_id,
      role_id: user.role_id,
      role_name: user.role_name,
      botanist_type: user.botanist_type
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
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

module.exports = { register, login };
