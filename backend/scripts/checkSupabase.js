// Checks that the Supabase project in .env is set up for this backend.
// Read-only: it never changes anything. Run with: npm run check-supabase
require('dotenv').config();
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const EXPECTED_TABLES = {
  roles: ['role_id', 'role_name'],
  users: ['user_id', 'full_name', 'email', 'password_hash', 'role_id', 'botanist_type', 'is_active', 'created_at'],
  plants: ['plant_id', 'qr_code', 'common_name', 'scientific_name', 'family', 'genus', 'species', 'height_cm',
    'width_cm', 'morphological_notes', 'surrounding_environment', 'latitude', 'longitude', 'location_visibility',
    'general_location', 'conservation_status', 'publication_status', 'ecological_role', 'medicinal_use',
    'cultural_significance', 'registered_by', 'created_at', 'updated_at'],
  plant_photos: ['photo_id', 'plant_id', 'photo_url', 'uploaded_by', 'uploaded_at'],
  record_change_requests: ['request_id', 'plant_id', 'plant_qr_code_snapshot', 'plant_scientific_name_snapshot',
    'request_type', 'proposed_changes', 'requested_by', 'requested_at', 'status', 'reviewed_by', 'reviewed_at',
    'review_comment'],
  botanist_assignments: ['assignment_id', 'botanist_id', 'plant_id', 'assigned_by', 'assigned_at'],
  audit_logs: ['log_id', 'user_id', 'action', 'target_table', 'target_id', 'details', 'created_at']
};

const ok = (msg) => console.log(`  OK    ${msg}`);
const bad = (msg) => console.log(`  FIX   ${msg}`);
const info = (msg) => console.log(`        ${msg}`);

async function checkDatabase() {
  console.log('\nDatabase (DATABASE_URL)');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
  try {
    await client.connect();
  } catch (err) {
    bad(`Cannot connect: ${err.message}`);
    return;
  }
  ok('Connected');

  try {
    const { rows } = await client.query(
      `SELECT c.relname AS table_name, c.relrowsecurity AS rls,
              array_agg(a.attname::text ORDER BY a.attnum) AS columns
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE n.nspname = 'public' AND c.relkind = 'r'
       GROUP BY c.relname, c.relrowsecurity
       ORDER BY c.relname`
    );
    const found = Object.fromEntries(rows.map((r) => [r.table_name, r]));

    const missing = Object.keys(EXPECTED_TABLES).filter((t) => !found[t]);
    const extra = rows.map((r) => r.table_name).filter((t) => !EXPECTED_TABLES[t]);

    if (missing.length === Object.keys(EXPECTED_TABLES).length) {
      bad('None of our tables exist yet - run sprint1_database_schema.sql in the SQL Editor');
    } else if (missing.length > 0) {
      bad(`Missing tables: ${missing.join(', ')}`);
    }
    for (const [table, columns] of Object.entries(EXPECTED_TABLES)) {
      if (!found[table]) continue;
      const have = found[table].columns;
      const missingCols = columns.filter((c) => !have.includes(c));
      const extraCols = have.filter((c) => !columns.includes(c));
      if (missingCols.length === 0 && extraCols.length === 0) {
        ok(`${table}: columns match${found[table].rls ? '' : ' (but RLS is OFF)'}`);
      } else {
        bad(`${table}: different from our schema`);
        if (missingCols.length) info(`missing columns: ${missingCols.join(', ')}`);
        if (extraCols.length) info(`extra columns:   ${extraCols.join(', ')}`);
      }
      if (!found[table].rls) info('RLS is off - anyone with the publishable key can read this table');
    }
    if (extra.length > 0) {
      info(`Other tables in the project (not used by this backend): ${extra.join(', ')}`);
    }

    if (found.users && found.roles && missing.length === 0) {
      const { rows: admins } = await client.query(
        `SELECT u.email, u.is_active, u.password_hash LIKE '$2%' AS bcrypt
         FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE r.role_name = 'Admin'`
      );
      if (admins.length === 0) {
        bad('No Admin account yet - create one (README Step 5)');
      } else {
        for (const a of admins) {
          if (!a.bcrypt) bad(`Admin ${a.email}: password_hash is not a bcrypt hash, login will fail`);
          else if (!a.is_active) bad(`Admin ${a.email}: account is deactivated`);
          else ok(`Admin account: ${a.email}`);
        }
      }
      const { rows: [counts] } = await client.query(
        `SELECT (SELECT COUNT(*) FROM users)::int AS users, (SELECT COUNT(*) FROM plants)::int AS plants`
      );
      info(`Rows: ${counts.users} users, ${counts.plants} plants`);
    }

    // Accounts made with Supabase Auth (not used by this backend)
    const { rows: [authUsers] } = await client.query(
      `SELECT COUNT(*)::int AS n FROM auth.users`
    ).catch(() => ({ rows: [{ n: null }] }));
    if (authUsers.n) {
      info(`${authUsers.n} account(s) exist in Supabase Auth - this backend does not use those for login`);
    }
  } finally {
    await client.end();
  }
}

async function checkStorage() {
  console.log('\nStorage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (key.startsWith('sb_publishable_')) {
    bad('SUPABASE_SERVICE_ROLE_KEY is the publishable key - use the secret key (sb_secret_...)');
    return;
  }
  const bucketName = process.env.SUPABASE_PHOTO_BUCKET || 'plant-photos';
  const supabase = createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: bucket, error } = await supabase.storage.getBucket(bucketName);
  if (error) {
    if (/not found/i.test(error.message)) {
      bad(`Bucket "${bucketName}" does not exist - create it in Storage and turn on "Public bucket"`);
    } else {
      bad(`Cannot reach Storage: ${error.message} (check SUPABASE_URL and the secret key)`);
    }
    return;
  }
  if (bucket.public) ok(`Bucket "${bucketName}" exists and is public`);
  else bad(`Bucket "${bucketName}" is private - turn on "Public bucket", or photo links won't open`);
}

(async () => {
  for (const name of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[name]) {
      console.log(`${name} is not set in .env`);
      process.exit(1);
    }
  }
  await checkDatabase();
  await checkStorage();
  console.log('');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
