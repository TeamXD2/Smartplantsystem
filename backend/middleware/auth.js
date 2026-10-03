const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Verifies the JWT sent in the Authorization header: "Bearer <token>"
// On success, attaches { user_id, role_id, role_name, botanist_type } to req.user
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    // Re-read role/status so deactivation or role changes apply immediately,
    // not only after the token expires.
    const [rows] = await pool.query(
      `SELECT u.user_id, u.is_active, u.botanist_type, r.role_id, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [decoded.user_id]
    );
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ error: 'Account is no longer active' });
    }
    const { is_active, ...user } = rows[0];
    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during authentication' });
  }
}

module.exports = authenticate;
