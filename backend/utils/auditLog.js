const pool = require('../config/db');

// Writes one row into audit_logs.
// user_id can be null (e.g. for actions with no logged-in actor).
// details should be a plain JS object - it gets stored as JSON.
async function logAction({ user_id = null, action, target_table = null, target_id = null, details = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, target_table, target_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, action, target_table, target_id, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Audit logging must never crash the main request - just log the failure.
    console.error('Failed to write audit log:', err);
  }
}

module.exports = { logAction };
