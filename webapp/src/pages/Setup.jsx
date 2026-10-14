import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createFirstAdmin } from '../queries/setup';

// One-time page for creating the first administrator. SetupGate shows it only
// while the backend reports that no Admin exists, and never again afterwards.
export default function Setup({ keyRequired, onDone }) {
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
      <div className="auth-side">
        <Leaf size={28} color="var(--amber-500)" />
        <h2>First-run setup</h2>
        <p>
          No administrator exists yet. The account you create here becomes the administrator and can create
          every other account. This page appears only once and disappears as soon as an administrator exists.
        </p>
      </div>
      <div className="auth-form-side">
        <form onSubmit={handleSubmit} className="auth-form stack">
          <h2>Create the administrator</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Full name</label>
            <input className="input" required maxLength={100} autoComplete="name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" required maxLength={150} autoComplete="username" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => update('password', e.target.value)} />
            <span className="field-hint">8 to 72 characters.</span>
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" className="input" required autoComplete="new-password" value={form.confirm} onChange={(e) => update('confirm', e.target.value)} />
          </div>
          {keyRequired && (
            <div className="field">
              <label>Setup key</label>
              <input type="password" className="input" required autoComplete="off" value={form.setup_key} onChange={(e) => update('setup_key', e.target.value)} />
              <span className="field-hint">The SETUP_KEY value from the backend's .env file.</span>
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating…' : 'Create administrator'}
          </button>
        </form>
      </div>
    </div>
  );
}
