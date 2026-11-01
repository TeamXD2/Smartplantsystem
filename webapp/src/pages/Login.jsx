import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../roles';
import Field from '../components/ui/Field';
import PasswordInput from '../components/ui/PasswordInput';
import { useDocumentTitle } from '../hooks';

export default function Login() {
  useDocumentTitle('Staff login');
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
      <form onSubmit={handleSubmit} className="auth-form" noValidate={false}>
        <div className="auth-brand">
          <div className="auth-logo"><Leaf size={30} aria-hidden="true" /></div>
          <h1 className="auth-title">RimbaTag</h1>
          <p className="auth-sub">Staff sign-in · Niah National Park</p>
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Field label="Email">
          <input type="email" className="input" placeholder="you@sfc.gov.my" required autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="auth-help">Accounts are created by an administrator. Ask yours if you need access.</p>
        <p className="auth-footer">Niah National Park · Sarawak Forestry Corporation</p>
      </form>
    </div>
  );
}
