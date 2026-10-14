// Account management (Admin only; the backend enforces it).
import { api } from '../api';

export function fetchUsers() {
  return api('/api/users');
}

// updates: { is_active } and/or { role_name, botanist_type }
export function updateUser(id, updates) {
  return api(`/api/users/${id}`, { method: 'PATCH', body: updates });
}

// There is no public sign-up: an Admin creates every account.
// account: { full_name, email, password, role_name, botanist_type }
export function createUser(account) {
  return api('/api/auth/register', { method: 'POST', body: account });
}
