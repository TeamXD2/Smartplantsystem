import { ROLES } from '../roles';

// Admins and Conservation Officers can publish, delete and manage accounts, so their passwords
// need at least 12 characters. Everyone else needs 8. The backend (utils/passwordPolicy.js)
// enforces this and also refuses very common passwords and ones that contain the person's name or email.
const STRONG_ROLES = [ROLES.ADMIN, ROLES.OFFICER];

export const minPasswordLength = (role) => (STRONG_ROLES.includes(role) ? 12 : 8);

export const passwordHint = (role) =>
  `${minPasswordLength(role)} to 72 characters. Very common passwords are refused.`;
