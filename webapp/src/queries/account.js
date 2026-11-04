// Passwords and the audit log.
import { api } from '../api';

// Any logged-in user changes their own password.
// Changing the password ends every other login of the account; the backend replaces this
// browser's session cookie with a fresh one, so the person stays signed in.
export function changePassword(current_password, new_password) {
  return api('/api/auth/password', { method: 'PATCH', body: { current_password, new_password } });
}

// Admin sets a temporary password for someone else (no email service).
export function resetPassword(userId, new_password) {
  return api(`/api/users/${userId}/reset-password`, { method: 'POST', body: { new_password } });
}

// Admin: who did what, when. params: { action, user_id, page, limit }
export function fetchAuditLogs(params) {
  return api('/api/audit-logs', { params });
}
