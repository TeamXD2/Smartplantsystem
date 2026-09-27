import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkAdminExists, claimFirstAdmin } from '../queries/setup';

const DASHBOARD_PATH = {
  botanist: '/botanist',
  conservation_officer: '/officer',
  admin: '/admin',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Only used to show the banner below - the actual safety check happens
  // fresh (via handleSubmit) at the moment someone logs in.
  useEffect(() => {
    checkAdminExists().then((exists) => setNeedsSetup(!exists)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);

      // Covers the case where this person registered before an admin
      // existed, but had to confirm their email first - so the very
      // first successful login is when we can actually promote them.
      if (user.role !== 'admin' && !(await checkAdminExists())) {
        await claimFirstAdmin();
        navigate('/admin');
        return;
      }

      navigate(DASHBOARD_PATH[user.role] || '/');
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
          {needsSetup && (
            <div className="alert alert-warning">
              No administrator account has been set up yet.{' '}
              <Link to="/register">Create the admin account</Link>.
            </div>
          )}
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Botanist account? <Link to="/register">Register here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
