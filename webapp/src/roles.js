// Role names exactly as the backend sends them (users.role_name).
export const ROLES = {
  BOTANIST: 'Botanist',
  OFFICER: 'Conservation Officer',
  ADMIN: 'Admin',
};

export const BOTANIST_TYPES = ['Internal', 'External'];

export function dashboardPath(user) {
  if (!user) return '/login';
  if (user.role_name === ROLES.OFFICER) return '/officer';
  if (user.role_name === ROLES.ADMIN) return '/admin';
  return '/botanist';
}

// External Botanists can't edit directly: they send edit requests instead.
export function isExternalBotanist(user) {
  return Boolean(user) && user.role_name === ROLES.BOTANIST && user.botanist_type === 'External';
}
