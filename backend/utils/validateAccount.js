// Rules for a new account, shared by the Admin's "create account" endpoint and
// the first-run setup. Returns an error message, or null when everything is valid.

// Shared by account creation, change password and admin password reset.
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return 'password must be 8 to 72 characters';
  }
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateNewAccount({ full_name, email, password, role_name, botanist_type }) {
  if (!full_name || !email || !password || !role_name) {
    return 'full_name, email, password, and role_name are required';
  }
  if (typeof full_name !== 'string' || full_name.trim().length === 0 || full_name.trim().length > 100) {
    return 'full_name must be text of at most 100 characters';
  }
  if (typeof email !== 'string' || email.length > 150 || !EMAIL_PATTERN.test(email.trim())) {
    return 'email must be a valid email address (max 150 characters)';
  }
  // bcrypt only uses the first 72 bytes of a password, so longer ones are refused
  // instead of being silently cut short.
  const badPassword = validatePassword(password);
  if (badPassword) {
    return badPassword;
  }
  if (typeof role_name !== 'string') {
    return 'Invalid role_name';
  }
  if (botanist_type !== undefined && botanist_type !== null && !['Internal', 'External'].includes(botanist_type)) {
    return "botanist_type must be 'Internal' or 'External'";
  }
  // A Botanist without a type would be treated as Internal (full edit rights),
  // so the type must be chosen explicitly. Other roles never have one.
  if (role_name === 'Botanist' && !botanist_type) {
    return "botanist_type ('Internal' or 'External') is required for Botanists";
  }
  if (role_name !== 'Botanist' && botanist_type) {
    return 'botanist_type only applies to Botanists';
  }
  return null;
}

module.exports = { validateNewAccount, validatePassword };
