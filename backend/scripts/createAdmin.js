// Recovery tool. The first Admin is normally created on the web app's setup page;
// use this when no one can sign in as an Admin any more (e.g. the password is lost).
//
//   npm run create-admin -- "Full Name" admin@example.com 'a-strong-password'
//
// Refuses to run if an active Admin already exists, unless --force is added.
// Note: the password ends up in your shell history; change it afterwards if
// that matters on a shared machine.
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--force');
  const force = process.argv.includes('--force');
  const [fullName, email, password] = args;

  if (!fullName || !email || !password) {
    console.error('Usage: npm run create-admin -- "Full Name" email password [--force]');
    process.exit(1);
  }
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    console.error('The password must be 8 to 72 characters.');
    process.exit(1);
  }

  const { rows: adminRows } = await pool.query(
    `SELECT u.email FROM users u JOIN roles r ON u.role_id = r.role_id
     WHERE r.role_name = 'Admin' AND u.is_active`
  );
  if (adminRows.length > 0 && !force) {
    console.error(`An active Admin already exists (${adminRows[0].email}). Use --force to add another.`);
    process.exit(1);
  }

  const { rows: roleRows } = await pool.query("SELECT role_id FROM roles WHERE role_name = 'Admin'");
  if (roleRows.length === 0) {
    console.error("The 'Admin' role is missing - has sprint1_database_schema.sql been run?");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows: [created] } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4) RETURNING user_id`,
    [fullName.trim(), email.trim(), hash, roleRows[0].role_id]
  );
  console.log(`Admin created (user_id ${created.user_id}). You can log in with ${email.trim()}.`);
}

main()
  .catch((err) => {
    console.error(err.code === '23505' ? 'That email is already registered.' : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
