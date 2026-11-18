// Runs the whole Postman collection against a FRESH, throwaway database, never the shared one.
//
//   npm run test:api
//
// Every run:
//   1. starts a private Postgres (embedded-postgres, nothing to install) in backend/.test-db,
//      or uses TEST_DATABASE_URL if you set it (its database name must contain "test"),
//   2. wipes it and applies schema.sql, then creates a test Admin,
//   3. starts this backend on TEST_PORT (default 5055) connected to that database,
//   4. runs postman/Biodiversity-Sprint1.postman_collection.json with newman,
//   5. removes the photos the run uploaded from Supabase Storage, and stops everything.
//
// Photo uploads still go to the Supabase Storage buckets in .env (there is no local Storage),
// which is why step 5 deletes them again. Nothing is written to the shared database.
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const COLLECTION = path.join(ROOT, 'postman', 'Biodiversity-Sprint1.postman_collection.json');
const SCHEMA = path.join(ROOT, '..', 'schema.sql');
const PORT = Number(process.env.TEST_PORT || 5055);
const PG_PORT = Number(process.env.TEST_PG_PORT || 54329);
const ADMIN = { name: 'Test Admin', email: 'testadmin@rimbatag.test', password: 'Kinabalu-Fern-Ledger-' + crypto.randomInt(1000, 9999) };
const DEVICE_KEY = crypto.randomBytes(16).toString('hex');

function log(message) {
  console.log(`[test:api] ${message}`);
}

// Refuses anything that could be the real database.
function checkTestUrl(url) {
  const db = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/test/i.test(db)) throw new Error(`TEST_DATABASE_URL must point to a database whose name contains "test" (got "${db}")`);
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL is the same as DATABASE_URL');
}

// embedded-postgres downloads the Postgres programs through npm and creates the data folder once.
// Starting and stopping go through Postgres's own pg_ctl, which shuts every server process down
// cleanly (killing them, as embedded-postgres does on Windows, can leave one holding the port).
const PG_DIR = path.join(ROOT, '.test-db');

async function pgCtlPath() {
  const platform = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform] || process.platform;
  const { pg_ctl } = await import(`@embedded-postgres/${platform}-${process.arch}`);
  return pg_ctl;
}

function pgCtl(binary, args) {
  return run(binary, [...args, '-D', PG_DIR], process.env);
}

async function startEmbeddedPostgres() {
  if (!fs.existsSync(path.join(PG_DIR, 'PG_VERSION'))) {
    log('First run: creating the local test Postgres in backend/.test-db');
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    await new EmbeddedPostgres({ databaseDir: PG_DIR, user: 'postgres', password: 'postgres', port: PG_PORT, persistent: true, onLog: () => {} }).initialise();
  }
  const binary = await pgCtlPath();
  // A run that was interrupted may have left it running.
  await pgCtl(binary, ['stop', '-m', 'fast', '-w']).catch(() => {});
  await pgCtl(binary, ['start', '-w', '-o', `-p ${PG_PORT}`, '-l', path.join(PG_DIR, 'server.log')]);
  return { stop: () => pgCtl(binary, ['stop', '-m', 'fast', '-w']) };
}

// Drops and recreates the test database, then applies schema.sql.
async function resetDatabase(url) {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const c = new Client({ connectionString: admin.toString() });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${dbName}" ENCODING 'UTF8' TEMPLATE template0`);
  await c.end();

  const db = new Client({ connectionString: url });
  await db.connect();
  await db.query(fs.readFileSync(SCHEMA, 'utf8'));
  await db.end();
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('exit', (code) => (code === 0 ? resolve(output) : reject(new Error(output.trim() || `${command} exited with ${code}`))));
  });
}

async function waitForServer(server) {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('The test backend stopped while starting');
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`The test backend did not answer on port ${PORT}`);
}

function runNewman() {
  const newman = require('newman');
  return new Promise((resolve, reject) => {
    newman.run({
      collection: COLLECTION,
      workingDir: path.join(ROOT, 'postman'),
      envVar: [
        { key: 'baseUrl', value: `http://localhost:${PORT}` },
        { key: 'adminEmail', value: ADMIN.email },
        { key: 'adminPassword', value: ADMIN.password },
        { key: 'deviceKey', value: DEVICE_KEY },
      ],
      reporters: ['cli'],
      reporter: { cli: { noConsole: true } },
    }, (err, summary) => (err ? reject(err) : resolve(summary)));
  });
}

// The run's uploads are real files in Supabase Storage: delete them.
async function removeUploadedPhotos(url) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const db = new Client({ connectionString: url });
  await db.connect();
  const { rows } = await db.query('SELECT photo_url, original_path FROM plant_photos');
  await db.end();
  if (rows.length === 0) return;
  const { removePhotoFiles } = require('../utils/photoStorage');
  await removePhotoFiles(rows);
  log(`Removed ${rows.length} test photo(s) from Supabase Storage`);
}

async function main() {
  let pg;
  let server;
  let url = process.env.TEST_DATABASE_URL;
  let failures = 1;
  try {
    if (url) {
      checkTestUrl(url);
    } else {
      pg = await startEmbeddedPostgres();
      url = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/rimbatag_test`;
    }

    log('Fresh test database + schema.sql');
    await resetDatabase(url);

    const env = {
      ...process.env,
      DATABASE_URL: url,
      DB_SSL: 'false',
      PORT: String(PORT),
      IOT_DEVICE_KEY: DEVICE_KEY,
      CORS_ORIGINS: `http://localhost:${PORT}`,
    };
    await run(process.execPath, ['scripts/createAdmin.js', ADMIN.name, ADMIN.email, ADMIN.password], env);

    log(`Starting the backend on port ${PORT}`);
    server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'pipe'] });
    let serverErrors = '';
    server.stderr.on('data', (d) => { serverErrors += d; });
    await waitForServer(server);

    const summary = await runNewman();
    failures = summary.run.failures.length;
    if (failures > 0 && serverErrors.includes('Error')) {
      console.log('\nBackend errors during the run:\n' + serverErrors.split('\n').filter((l) => !l.includes('DB_SSL_CA')).join('\n'));
    }
    await removeUploadedPhotos(url);
  } catch (err) {
    console.error(`[test:api] ${err && err.message ? err.message : err}`);
  } finally {
    if (server && server.exitCode === null) server.kill();
    if (pg) await pg.stop().catch(() => {});
  }
  log(failures === 0 ? 'All checks passed' : `${failures} check(s) failed`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
