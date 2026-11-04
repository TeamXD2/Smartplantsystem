const pool = require('../config/db');

// Runs fn(client) inside one database transaction: everything it does is saved together,
// or - if fn throws - none of it is. Used where a change and its audit log entry must
// stand or fall together.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
