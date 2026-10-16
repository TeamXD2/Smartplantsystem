const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

// Connects to the Supabase Postgres database using the connection string from
// Supabase Dashboard -> Connect -> "Session pooler" (works on IPv4 networks).
//
// TLS: the connection is always encrypted. Whether the server's certificate is
// also *verified* depends on DB_SSL_CA:
//   - DB_SSL_CA set   -> certificate is verified against that CA (recommended).
//                        Value is a path to the .crt file, or the PEM text itself.
//                        Supabase Dashboard -> Database -> Settings -> SSL
//                        Configuration -> Download certificate.
//   - DB_SSL_CA unset -> encrypted but NOT verified (old behaviour, a warning is
//                        printed at startup).
//   - DB_SSL=false    -> no TLS, only for a local Postgres (e.g. `supabase start`).
function buildSslConfig() {
  if (process.env.DB_SSL === 'false') {
    return false;
  }

  const ca = process.env.DB_SSL_CA;
  if (ca) {
    const pem = ca.includes('BEGIN CERTIFICATE') ? ca.replace(/\\n/g, '\n') : fs.readFileSync(ca, 'utf8');
    return { ca: pem, rejectUnauthorized: true };
  }

  console.warn(
    '[security] DB_SSL_CA is not set: the database connection is encrypted but the server ' +
    'certificate is not verified. See the "Configuration" section of the root README.'
  );
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
  max: 10
});

// An idle client losing its connection (e.g. Supabase restarting) must not
// crash the server - the pool just replaces it.
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
