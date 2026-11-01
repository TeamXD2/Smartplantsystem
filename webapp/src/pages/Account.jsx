import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { changePassword } from '../queries/account';
import { useDocumentTitle } from '../hooks';
import { useUnsavedChanges } from '../useUnsavedChanges';
import PageHeader from '../components/ui/PageHeader';
import Field from '../components/ui/Field';
import { initialsOf } from '../components/shell/UserMenu';

// "My account" for every staff member: who you are + change your password.
export default function Account() {
  useDocumentTitle('My account');
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = Boolean(form.current || form.next || form.confirm);
  useUnsavedChanges(dirty && !busy);

  const mismatch = form.confirm && form.next !== form.confirm ? 'The new passwords do not match.' : '';

  async function submit(e) {
    e.preventDefault();
    if (form.next !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      setError('');
      toast.success('Password changed.', { detail: 'Use the new password next time you log in.' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const type = show ? 'text' : 'password';
  return (
    <div className="narrow">
      <PageHeader title="My account" description="Who you are here, and your password." />

      <div className="panel user-card">
        <div className="avatar">{initialsOf(user)}</div>
        <div>
          <div className="user-name">{user.full_name}</div>
          <div className="muted">{user.email}</div>
          <span className="tag tag-approved" style={{ marginTop: 8 }}>{user.role_name}{user.botanist_type ? ` (${user.botanist_type})` : ''}</span>
        </div>
      </div>

      <form className="panel panel-form" onSubmit={submit}>
        <h2 className="panel-title"><KeyRound size={18} aria-hidden="true" /> Change password</h2>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Field label="Current password">
          <input type={type} className="input" required autoComplete="current-password" value={form.current} onChange={(e) => set('current', e.target.value)} />
        </Field>
        <Field label="New password" hint="8 to 72 characters.">
          <input type={type} className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.next} onChange={(e) => set('next', e.target.value)} />
        </Field>
        <Field label="Confirm new password" error={mismatch}>
          <input type={type} className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
        </Field>
        <label className="check-row">
          <input type="checkbox" className="check" checked={show} onChange={(e) => setShow(e.target.checked)} />
          {show ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />} Show passwords
        </label>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>
    </div>
  );
}
