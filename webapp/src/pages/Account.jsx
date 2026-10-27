import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../queries/account';

// "My account" for every staff member: who you are + change your password.
// Laid out like the Profile screen in the mobile app.
export default function Account() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const initials = (user.full_name || user.email).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  async function submit(e) {
    e.preventDefault();
    setNotice('');
    if (form.next !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setError('');
      setNotice('Password changed. Use the new password next time you log in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <h2>My Account</h2>

      <div className="panel user-card">
        <div className="avatar">{initials}</div>
        <div>
          <div className="user-name">{user.full_name}</div>
          <div className="muted">{user.email}</div>
          <span className="tag tag-approved" style={{ marginTop: 8 }}>
            {user.role_name}{user.botanist_type ? ` (${user.botanist_type})` : ''}
          </span>
        </div>
      </div>

      <form className="panel" onSubmit={submit}>
        <h3><KeyRound size={18} /> Change password</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-success">{notice}</div>}
        <div className="field">
          <label>Current password</label>
          <input type="password" className="input" required autoComplete="current-password" value={form.current} onChange={(e) => set('current', e.target.value)} />
        </div>
        <div className="field">
          <label>New password</label>
          <input type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.next} onChange={(e) => set('next', e.target.value)} />
          <span className="field-hint">8 to 72 characters.</span>
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
      </form>
    </div>
  );
}
