// First-run setup: creating the very first administrator. The backend allows this
// only while the database has no Admin at all.
import { api } from '../api';

// -> { setup_required: boolean, key_required: boolean }
export function fetchSetupStatus() {
  return api('/api/setup/status', { auth: false });
}

// account: { full_name, email, password, setup_key? }
export function createFirstAdmin(account) {
  return api('/api/setup/admin', { method: 'POST', body: account, auth: false });
}
