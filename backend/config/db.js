const { Pool } = require('pg');
require('dotenv').config();

// Connects to the Supabase Postgres database using the connection string from
// Supabase Dashboard -> Connect -> "Session pooler" (works on IPv4 networks).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL. Its certificate isn't in Node's default CA list,
  // so verification is skipped here; the connection is still encrypted.
  // DB_SSL=false is only for a local Postgres (e.g. `supabase start`).
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10
});

// An idle client losing its connection (e.g. Supabase restarting) must not
// crash the server - the pool just replaces it.
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
