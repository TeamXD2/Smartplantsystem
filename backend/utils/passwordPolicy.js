const fs = require('fs');
const path = require('path');

// Password rules, shared by account creation, first-run setup, changing a password,
// an Admin's password reset and the create-admin script.
//
//  - Length: Admins and Conservation Officers (accounts that can publish, delete and manage
//    people) need at least 12 characters, everyone else at least 8. Nobody may exceed 72
//    bytes, because bcrypt ignores everything after that.
//  - Not a common password: refused when it is in data/common-passwords.txt (the 100,000
//    most common passwords, 8+ characters), also when only digits or symbols were added
//    at the end ("Password123!" counts as "password"). The check is entirely offline.
//  - Not built from the person's own details: it must not contain the email address
//    (before the @) or a name part of 4+ letters.
//  - Not repetitive: at least 4 different characters.
//
// Existing passwords are not re-checked; the rules apply the next time one is set.

const STRONG_ROLES = new Set(['Admin', 'Conservation Officer']);
const MIN_STRONG = 12;
const MIN_DEFAULT = 8;
const MAX_BYTES = 72;

const COMMON = new Set(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'common-passwords.txt'), 'utf8').split('\n').filter(Boolean)
);

function minimumLength(role_name) {
  return STRONG_ROLES.has(role_name) ? MIN_STRONG : MIN_DEFAULT;
}

// Pieces of the person's details that must not appear inside the password.
function personalParts({ email, full_name }) {
  const parts = new Set();
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local.length >= 4) parts.add(local);
  const compact = local.replace(/[^a-z0-9]/g, '');
  if (compact.length >= 4) parts.add(compact);
  for (const piece of local.split(/[^a-z0-9]+/)) {
    if (piece.length >= 4) parts.add(piece);
  }
  for (const piece of String(full_name || '').toLowerCase().split(/[^a-z]+/)) {
    if (piece.length >= 4) parts.add(piece);
  }
  return [...parts];
}

// Returns an error message, or null when the password is acceptable.
// context: { role_name, email, full_name } of the account the password is for.
function checkPassword(password, context = {}) {
  const min = minimumLength(context.role_name);
  if (typeof password !== 'string' || password.length < min || Buffer.byteLength(password) > MAX_BYTES) {
    return STRONG_ROLES.has(context.role_name)
      ? `password must be ${min} to ${MAX_BYTES} characters for Admins and Conservation Officers`
      : `password must be ${min} to ${MAX_BYTES} characters`;
  }

  const lower = password.toLowerCase();
  const withoutTail = lower.replace(/[^a-z]+$/, ''); // "password123!" -> "password"
  if (COMMON.has(lower) || COMMON.has(withoutTail)) {
    return 'That password is too common. Choose a longer or less predictable one.';
  }
  if (personalParts(context).some((part) => lower.includes(part))) {
    return 'The password must not contain your name or email address.';
  }
  if (new Set(password).size < 4) {
    return 'That password is too repetitive. Use more different characters.';
  }
  return null;
}

module.exports = { checkPassword };
