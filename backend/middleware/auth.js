const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { allowedOrigins } = require('../config/origins');
const { SESSION_COOKIE, parseCookies, csrfMatches, clearSessionCookies } = require('../utils/sessionCookie');
require('dotenv').config();

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Verifies the login token. It comes either in the Authorization header ("Bearer <token>", used by
// the mobile app, Postman and scripts) or in the httpOnly session cookie (used by the web app).
// On success, attaches { user_id, role_id, role_name, botanist_type } to req.user, and
// req.sessionToken / req.authVia ('bearer' or 'cookie').
//
// A request authenticated by the cookie is protected against CSRF (another website making the
// browser send the cookie): a request that changes data must also carry the matching
// X-CSRF-Token header, and if the browser sent an Origin it must be one of CORS_ORIGINS.
// A Bearer header is never sent by a browser by itself, so it needs neither.
//
// A token is only valid while the number inside it (tv) still equals the account's
// users.token_version. Changing or resetting a password, deactivating the account,
// changing its role, or "sign out everywhere" raises that number, so every token
// issued before then stops working immediately - a stolen token does not outlive
// the owner's password change.
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token;
  let via;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    via = 'bearer';
  } else {
    token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    via = 'cookie';
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // A rejected cookie session is removed from the browser, so the web app knows it is signed out.
  const reject = (status, error) => {
    if (via === 'cookie') clearSessionCookies(res);
    return res.status(status).json({ error });
  };

  let decoded;
  try {
    // Only the algorithm we sign with is accepted (rules out "alg" tricks).
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return reject(401, 'Invalid or expired token');
  }

  if (via === 'cookie' && !SAFE_METHODS.includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'This request came from an address that is not allowed' });
    }
    if (!csrfMatches(token, req.get('X-CSRF-Token'))) {
      return res.status(403).json({ error: 'Security check failed (CSRF). Reload the page and try again' });
    }
  }

  try {
    // Re-read role/status so deactivation or role changes apply immediately,
    // not only after the token expires.
    const { rows } = await pool.query(
      `SELECT u.user_id, u.is_active, u.token_version, u.botanist_type, r.role_id, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`,
      [decoded.user_id]
    );
    if (rows.length === 0 || !rows[0].is_active) {
      return reject(401, 'Account is no longer active');
    }
    // Tokens issued before token_version existed carry no tv; they count as version 0.
    if ((decoded.tv ?? 0) !== rows[0].token_version) {
      return reject(401, 'Your session has ended, please log in again');
    }
    const { is_active, token_version, ...user } = rows[0];
    req.user = user;
    req.sessionToken = token;
    req.authVia = via;
    next();
  } catch (err) {
    if (err.code === '42703') {
      return res.status(503).json({ error: 'The database is out of date: run schema.sql in Supabase again' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error during authentication' });
  }
}

module.exports = authenticate;
