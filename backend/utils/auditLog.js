const pool = require('../config/db');
const { currentContext } = require('../middleware/requestContext');

// Every entry also records the caller's IP address and device (from the request that is
// being handled, see middleware/requestContext.js). Outside a request (scripts) both are null.
const INSERT_SQL = `INSERT INTO audit_logs (user_id, action, target_table, target_id, details, ip_address, user_agent)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`;

function auditValues({ user_id = null, action, target_table = null, target_id = null, details = null }) {
  const { ip, userAgent } = currentContext();
  return [user_id, action, target_table, target_id, details ? JSON.stringify(details) : null, ip, userAgent];
}

// Writes one row into audit_logs AFTER the action has happened.
// user_id can be null (e.g. for actions with no logged-in actor).
// details should be a plain JS object - it gets stored as JSON.
async function logAction(entry) {
  try {
    await pool.query(INSERT_SQL, auditValues(entry));
  } catch (err) {
    // Audit logging must never crash the main request - just log the failure.
    console.error('Failed to write audit log:', err);
  }
}

// Writes the row INSIDE a transaction the caller already started (see utils/transaction.js).
// Unlike logAction it does not swallow errors: if the entry cannot be written, the whole
// transaction - the change itself included - is rolled back, so a sensitive action can
// never happen without leaving a record.
async function logActionTx(client, entry) {
  await client.query(INSERT_SQL, auditValues(entry));
}

module.exports = { logAction, logActionTx };
