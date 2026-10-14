const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/db');
const { logAction } = require('../utils/auditLog');
const { validateNewAccount } = require('../utils/validateAccount');

// First-run setup: while the database has no Admin at all, anyone can create the
// first one through these two public endpoints. As soon as an Admin exists
// (active or not) they stop working for good. Later accounts are created by an
// Admin through POST /api/auth/register.

// Arbitrary number for the Postgres advisory lock that serialises concurrent setups.
const SETUP_LOCK_ID = 7340112;

async function adminExists(db) {
  const { rows } = await db.query(
    `SELECT 1 FROM users u JOIN roles r ON u.role_id = r.role_id
     WHERE r.role_name = 'Admin' LIMIT 1`
  );
  return rows.length > 0;
}

// Optional extra protection for a freshly deployed, internet-facing backend: if
// SETUP_KEY is set in .env, the setup request has to include it.
function setupKeyIsValid(provided) {
  const expected = process.env.SETUP_KEY;
  if (!expected) return true;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET /api/setup/status  (public)
async function getSetupStatus(req, res) {
  try {
    const setupRequired = !(await adminExists(pool));
    res.json({
      setup_required: setupRequired,
      key_required: setupRequired && Boolean(process.env.SETUP_KEY)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while checking setup status' });
  }
}

// POST /api/setup/admin  (public, only while no Admin exists)
// Body: { full_name, email, password, setup_key? }
async function createFirstAdmin(req, res) {
  const { setup_key, ...account } = req.body || {};
  let connection;

  try {
    if (await adminExists(pool)) {
      return res.status(409).json({ error: 'Setup is already complete' });
    }
    if (!setupKeyIsValid(setup_key)) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }
    const invalid = validateNewAccount({ ...account, role_name: 'Admin', botanist_type: undefined });
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    const password_hash = await bcrypt.hash(account.password, 10);

    connection = await pool.connect();
    await connection.query('BEGIN');
    // Two simultaneous setups queue here; the second one then sees the Admin the first created.
    await connection.query('SELECT pg_advisory_xact_lock($1)', [SETUP_LOCK_ID]);

    if (await adminExists(connection)) {
      await connection.query('ROLLBACK');
      return res.status(409).json({ error: 'Setup is already complete' });
    }

    const { rows: roleRows } = await connection.query("SELECT role_id FROM roles WHERE role_name = 'Admin'");
    if (roleRows.length === 0) {
      await connection.query('ROLLBACK');
      return res.status(500).json({ error: "The 'Admin' role is missing from the database" });
    }

    const { rows: [created] } = await connection.query(
      'INSERT INTO users (full_name, email, password_hash, role_id) VALUES ($1, $2, $3, $4) RETURNING user_id',
      [account.full_name.trim(), account.email.trim(), password_hash, roleRows[0].role_id]
    );
    await connection.query('COMMIT');

    await logAction({
      user_id: created.user_id,
      action: 'CREATE_USER',
      target_table: 'users',
      target_id: created.user_id,
      details: { role_name: 'Admin', via: 'first-run setup' }
    });

    res.status(201).json({ message: 'Administrator account created' });
  } catch (err) {
    if (connection) await connection.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(400).json({ error: 'That email is already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error during setup' });
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { getSetupStatus, createFirstAdmin };
