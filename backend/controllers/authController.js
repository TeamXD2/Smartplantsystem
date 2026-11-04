const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logAction, logActionTx } = require('../utils/auditLog');
const { withTransaction } = require('../utils/transaction');
const { checkLoginAllowed, recordFailure, clearFailures, waitText } = require('../utils/loginThrottle');
const { validateNewAccount, validatePassword } = require('../utils/validateAccount');
const { wantsCookie, setSessionCookies, refreshCsrfCookie, clearSessionCookies } = require('../utils/sessionCookie');
require('dotenv').config();

// How long a login token works. Short on purpose: a token cannot be taken back once
// issued, except through token_version (see middleware/auth.js).
const TOKEN_LIFETIME = process.env.JWT_EXPIRES_IN || '12h';

// The signed login token. tv ties it to users.token_version.
function signToken(user, tokenVersion) {
  return jwt.sign(
    {
      user_id: user.user_id,
      role_id: user.role_id,
      role_name: user.role_name,
      botanist_type: user.botanist_type,
      tv: tokenVersion
    },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: TOKEN_LIFETIME }
  );
}

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

// An email as it should appear in the audit log. Something that is not an email (for example a
// password typed into the wrong box) is never written down.
const looksLikeEmail = (value) => typeof value === 'string' && value.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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

    // Too many recent failures for this email (from this IP address, or from anywhere): refuse
    // before looking at the password. The answer is the same whether or not the account exists.
    const blocked = await checkLoginAllowed(email, req.ip);
    if (blocked) {
      await logAction({
        action: 'LOGIN_BLOCKED',
        details: { scope: blocked.scope, email: looksLikeEmail(email) ? email.trim().toLowerCase() : '(not an email)' }
      });
      res.set('Retry-After', String(blocked.retryAfterSeconds));
      return res.status(429).json({ error: `Too many failed login attempts. Try again in ${waitText(blocked.retryAfterSeconds)}.` });
    }

    const { rows } = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.is_active, u.token_version,
              u.botanist_type, r.role_id, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      await recordFailure(email, req.ip);
      await logAction({
        user_id: user ? user.user_id : null,
        action: 'LOGIN_FAILED',
        target_table: user ? 'users' : null,
        target_id: user ? user.user_id : null,
        details: {
          reason: user ? 'wrong_password' : 'unknown_email',
          email: looksLikeEmail(email) ? email.trim().toLowerCase() : '(not an email)'
        }
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    // The right password wipes this IP address's failures for the email.
    await clearFailures(email, req.ip);

    // Checked only after the password, so a deactivated account isn't revealed
    // to someone who doesn't know the password.
    if (!user.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    const token = signToken(user, user.token_version);

    await logAction({ user_id: user.user_id, action: 'LOGIN' });

    const publicUser = {
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role_name: user.role_name,
      botanist_type: user.botanist_type
    };

    // The web app asks for a cookie session (X-Auth-Mode: cookie): the token goes into an httpOnly
    // cookie and is not part of the response. Everyone else gets the token in the response body.
    if (wantsCookie(req)) {
      setSessionCookies(res, token);
      return res.json({ user: publicUser });
    }
    res.json({ token, user: publicUser });
  } catch (err) {
    console.error(err);
    if (err.code === '42P01') {
      return res.status(503).json({ error: 'The database is out of date: run schema.sql in Supabase again' });
    }
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
    // Hands the page its CSRF value again, e.g. if the browser lost that cookie.
    if (req.authVia === 'cookie') refreshCsrfCookie(res, req.sessionToken);
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
    const { rows } = await pool.query('SELECT password_hash, email, full_name FROM users WHERE user_id = $1', [req.user.user_id]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const account = rows[0];

    // The rules depend on the account's role and must not allow its own name or email.
    const invalid = validatePassword(new_password, { role_name: req.user.role_name, email: account.email, full_name: account.full_name });
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }
    if (current_password === new_password) {
      return res.status(400).json({ error: 'The new password must be different from the current one' });
    }

    // Guessing the current password with a stolen token is slowed down like guessing at the login.
    const blocked = await checkLoginAllowed(account.email, req.ip);
    if (blocked) {
      await logAction({ user_id: req.user.user_id, action: 'LOGIN_BLOCKED', target_table: 'users', target_id: req.user.user_id, details: { scope: blocked.scope, via: 'change_password' } });
      res.set('Retry-After', String(blocked.retryAfterSeconds));
      return res.status(429).json({ error: `Too many failed attempts. Try again in ${waitText(blocked.retryAfterSeconds)}.` });
    }
    if (!(await bcrypt.compare(current_password, account.password_hash))) {
      await recordFailure(account.email, req.ip);
      await logAction({ user_id: req.user.user_id, action: 'PASSWORD_CHECK_FAILED', target_table: 'users', target_id: req.user.user_id });
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    await clearFailures(account.email, req.ip);

    const password_hash = await bcrypt.hash(new_password, 10);
    // Raising token_version ends every other session of this account (a stolen token
    // stops working). This request gets a fresh token so the person stays signed in here.
    // The change and its audit entry are saved together: no password change without a record.
    const updated = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(
        'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE user_id = $2 RETURNING token_version',
        [password_hash, req.user.user_id]
      );
      await logActionTx(client, { user_id: req.user.user_id, action: 'CHANGE_PASSWORD', target_table: 'users', target_id: req.user.user_id });
      return row;
    });

    const newToken = signToken(req.user, updated.token_version);
    // A cookie session gets its new cookie; an app that holds the token itself gets it in the response.
    if (req.authVia === 'cookie') {
      setSessionCookies(res, newToken);
      return res.json({ message: 'Password changed' });
    }
    res.json({ message: 'Password changed', token: newToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while changing the password' });
  }
}

// POST /api/auth/logout-all  (any logged-in user)
// "Sign out everywhere": every token of this account, including the one used for
// this request, stops working. The app then returns to the login screen.
async function logoutAll(req, res) {
  try {
    await withTransaction(async (client) => {
      await client.query('UPDATE users SET token_version = token_version + 1 WHERE user_id = $1', [req.user.user_id]);
      await logActionTx(client, { user_id: req.user.user_id, action: 'LOGOUT_ALL', target_table: 'users', target_id: req.user.user_id });
    });
    clearSessionCookies(res);
    res.json({ message: 'Signed out of all devices' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while signing out' });
  }
}

// POST /api/auth/logout  (no login needed)
// Removes this browser's session cookies. It ends only this browser's session; the token itself
// stays valid until it expires, which is fine because JavaScript could never read it. To end a
// session everywhere, including a token that may have leaked, use logout-all.
function logout(req, res) {
  clearSessionCookies(res);
  res.json({ message: 'Signed out' });
}

module.exports = { register, login, me, changePassword, logoutAll, logout };
