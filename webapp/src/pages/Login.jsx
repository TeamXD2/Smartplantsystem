import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../roles';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      navigate(dashboardPath(user));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <Leaf size={28} color="var(--amber-500)" />
        <h2>Staff access</h2>
        <p>Botanists, conservation officers and administrators sign in here to submit, review and manage field records for Niah National Park.</p>
      </div>
      <div className="auth-form-side">
        <form onSubmit={handleSubmit} className="auth-form stack">
          <h2>Staff Login</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
          <p className="muted" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Accounts are created by an administrator. Ask yours if you need access.
          </p>
        </form>
      </div>
    </div>
  );
}
