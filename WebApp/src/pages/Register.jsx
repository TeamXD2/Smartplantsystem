import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkAdminExists, claimFirstAdmin } from '../queries/setup';

// This page doubles as the app's first-run setup screen. Every new
// account starts as a 'botanist' (see supabase/schema.sql), but if no
// admin exists in the whole system yet, we say so up front and promote
// this account to admin the moment it's able to sign in - see
// claimFirstAdmin() for how that's made safe to do from the browser.
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(null); // null = still checking

  useEffect(() => {
    checkAdminExists()
      .then((exists) => setIsFirstRun(!exists))
      .catch(() => setIsFirstRun(false)); // if the check fails, fall back to a normal sign-up
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await register(form.name, form.email, form.password);

      if (result.confirmationRequired) {
        setConfirmationSent(true);
        return;
      }

      if (isFirstRun) {
        await claimFirstAdmin();
        navigate('/admin');
      } else {
        navigate('/botanist');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (isFirstRun === null) return null; // brief pause while we check for an existing admin

  if (confirmationSent) {
    return (
      <div className="page-narrow stack">
        <div className="alert alert-success">
          Almost there — check <strong>{form.email}</strong> for a confirmation link before logging in.
          {isFirstRun && ' Once you confirm and log in, this account will automatically become the administrator.'}
        </div>
        <Link to="/login" className="btn btn-outline btn-block">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <Leaf size={28} color="var(--amber-500)" />
        <h2>{isFirstRun ? 'First-run setup' : 'Join the field team'}</h2>
        <p>
          {isFirstRun
            ? 'No administrator has been set up yet. The account you create here becomes the administrator for this system.'
            : 'New accounts start with botanist access. An administrator can grant conservation officer or admin access afterwards.'}
        </p>
      </div>
      <div className="auth-form-side">
        <form onSubmit={handleSubmit} className="auth-form stack">
          <h2>{isFirstRun ? 'Set Up Administrator Account' : 'Register as Botanist'}</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Full name</label>
            <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" required value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" className="input" required minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} />
            <span className="field-hint">At least 8 characters.</span>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating account…' : isFirstRun ? 'Create admin account' : 'Register'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
