const crypto = require('crypto');
const pool = require('../config/db');

// Slows down password guessing for one account, on top of the per-IP limit in routes/authRoutes.js.
// Every failed attempt is remembered for a while (table login_failures), and a login is refused
// while either limit is reached:
//
//   - the same email from the same IP address: LOGIN_FAILS_PER_IP failures (default 5)
//   - the same email from anywhere:            LOGIN_FAILS_PER_ACCOUNT failures (default 20)
//
// within LOGIN_LOCK_MINUTES (default 15). A guesser is therefore stopped, while someone who only
// knows an email address cannot lock the real owner out by failing from one place: the owner's
// own IP address has its own count. Only a spread-out attack reaches the account-wide limit, and
// then the account is closed to everyone, even with the right password, until the window passes.
//
// The email is stored only as a hash, and unknown emails are counted like real ones, so the
// answer never shows whether an account exists.

const intFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
const PAIR_LIMIT = intFromEnv('LOGIN_FAILS_PER_IP', 5);
const ACCOUNT_LIMIT = intFromEnv('LOGIN_FAILS_PER_ACCOUNT', 20);
const WINDOW_MINUTES = intFromEnv('LOGIN_LOCK_MINUTES', 15);

const emailKey = (email) =>
  crypto.createHash('sha256').update(String(email).trim().toLowerCase().slice(0, 254)).digest('hex');

// When does a count of `limit` failures drop below the limit again? When the limit-th most recent
// failure leaves the window. Returns the seconds to wait, or 0 when the limit is not reached.
async function secondsUntilBelowLimit(db, key, ip, limit, perIp) {
  const { rows } = await db.query(
    `SELECT CEIL(EXTRACT(EPOCH FROM (created_at + make_interval(mins => $4) - NOW())))::int AS wait
     FROM login_failures
     WHERE email_hash = $1 AND created_at > NOW() - make_interval(mins => $4)
       AND ($3::boolean = FALSE OR ip_address IS NOT DISTINCT FROM $2)
     ORDER BY created_at DESC
     OFFSET $5 LIMIT 1`,
    [key, ip, perIp, WINDOW_MINUTES, limit - 1]
  );
  return rows.length ? Math.max(rows[0].wait, 1) : 0;
}

// Returns null when the attempt may go ahead, or { scope, retryAfterSeconds } when it is refused.
async function checkLoginAllowed(email, ip, db = pool) {
  const key = emailKey(email);
  const pairWait = await secondsUntilBelowLimit(db, key, ip, PAIR_LIMIT, true);
  const accountWait = await secondsUntilBelowLimit(db, key, ip, ACCOUNT_LIMIT, false);
  if (pairWait === 0 && accountWait === 0) return null;
  return accountWait >= pairWait
    ? { scope: 'account', retryAfterSeconds: accountWait }
    : { scope: 'ip', retryAfterSeconds: pairWait };
}

async function recordFailure(email, ip, db = pool) {
  await db.query('INSERT INTO login_failures (email_hash, ip_address) VALUES ($1, $2)', [emailKey(email), ip]);
  // Old rows are of no use; tidy up now and then instead of running a separate job.
  if (Math.random() < 0.02) {
    await db.query("DELETE FROM login_failures WHERE created_at < NOW() - INTERVAL '1 day'").catch(() => {});
  }
}

// A correct login wipes the failures of that email from that IP address.
async function clearFailures(email, ip, db = pool) {
  await db.query('DELETE FROM login_failures WHERE email_hash = $1 AND ip_address IS NOT DISTINCT FROM $2', [emailKey(email), ip]);
}

// "Try again in 14 minutes" for the error message.
function waitText(seconds) {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? 'a minute' : `${minutes} minutes`;
}

module.exports = { checkLoginAllowed, recordFailure, clearFailures, waitText };
