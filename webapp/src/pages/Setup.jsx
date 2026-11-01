import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import Field from '../components/ui/Field';
import { useDocumentTitle } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { createFirstAdmin } from '../queries/setup';

// One-time page for creating the first administrator. SetupGate shows it only
// while the backend reports that no Admin exists, and never again afterwards.
export default function Setup({ keyRequired, onDone }) {
  useDocumentTitle('First-run setup');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', setup_key: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await createFirstAdmin({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        setup_key: keyRequired ? form.setup_key : undefined,
      });
      await login(form.email.trim(), form.password);
      navigate('/admin');
      onDone();
    } catch (err) {
      if (err.status === 409) {
        // Someone else finished the setup first: carry on to the normal app.
        navigate('/login');
        onDone();
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-brand">
          <div className="auth-logo"><Leaf size={30} aria-hidden="true" /></div>
          <h1 className="auth-title">Create the administrator</h1>
          <p className="auth-sub">No administrator exists yet. This account will be able to create every other account, and this page disappears once it exists.</p>
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Field label="Full name">
          <input className="input" required maxLength={100} autoComplete="name" autoFocus value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className="input" required maxLength={150} autoComplete="username" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </Field>
        <Field label="Password" hint="8 to 72 characters.">
          <input type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => update('password', e.target.value)} />
        </Field>
        <Field label="Confirm password">
          <input type="password" className="input" required autoComplete="new-password" value={form.confirm} onChange={(e) => update('confirm', e.target.value)} />
        </Field>
        {keyRequired && (
          <Field label="Setup key" hint="The SETUP_KEY value from the backend's .env file.">
            <input type="password" className="input" required autoComplete="off" value={form.setup_key} onChange={(e) => update('setup_key', e.target.value)} />
          </Field>
        )}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create administrator'}
        </button>
      </form>
    </div>
  );
}
