import { useEffect, useState } from 'react';
import { fetchUsers, updateUser, createUser } from '../queries/users';
import { useAuth } from '../context/AuthContext';
import { ROLES, BOTANIST_TYPES } from '../roles';
import { resetPassword } from '../queries/account';

const ROLE_LIST = Object.values(ROLES);
const NEW_ACCOUNT = { full_name: '', email: '', password: '', role_name: ROLES.BOTANIST, botanist_type: 'Internal' };

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(NEW_ACCOUNT);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(null); // user_id whose password is being reset
  const [tempPassword, setTempPassword] = useState('');

  async function load() {
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function run(action, success) {
    try {
      await action();
      setError('');
      setNotice(success);
    } catch (err) {
      setNotice('');
      setError(err.message);
    }
    load();
  }

  function changeRole(u, role_name) {
    if (role_name === ROLES.BOTANIST) {
      // A Botanist must be Internal or External - the backend refuses otherwise,
      // and there is deliberately no default (Internal has full edit rights).
      // A Botanist must be Internal or External. Start as External (fewer rights);
      // the Admin can switch it to Internal in the "Botanist type" column.
      return run(
        () => updateUser(u.user_id, { role_name, botanist_type: 'External' }),
        'Role updated to Botanist (External). Change the botanist type if needed.'
      );
    }
    return run(() => updateUser(u.user_id, { role_name }), 'Role updated.');
  }

  function changeType(u, botanist_type) {
    return run(() => updateUser(u.user_id, { botanist_type }), 'Botanist type updated.');
  }

  function toggleActive(u) {
    return run(
      () => updateUser(u.user_id, { is_active: !u.is_active }),
      u.is_active ? 'Account deactivated.' : 'Account reactivated.'
    );
  }

  async function submitReset(e, u) {
    e.preventDefault();
    await run(() => resetPassword(u.user_id, tempPassword), `Temporary password set for ${u.email}. Share it with them privately.`);
    setResetting(null);
    setTempPassword('');
  }

  function updateForm(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await createUser({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role_name: form.role_name,
        botanist_type: form.role_name === ROLES.BOTANIST ? form.botanist_type : undefined,
      });
      setForm(NEW_ACCOUNT);
      setCreating(false);
      setError('');
      setNotice(`Account created for ${form.email.trim()}.`);
      load();
    } catch (err) {
      setNotice('');
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Users</h2>



      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <>
          <div style={{ marginBottom: '1rem' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setCreating((c) => !c)}>
              {creating ? 'Close' : 'Create account'}
            </button>
          </div>

          {creating && (
            <form className="panel stack" style={{ marginBottom: '1.5rem' }} onSubmit={handleCreate}>
              <h3>New account</h3>
              <div className="form-grid">
                <div className="field">
                  <label>Full name</label>
                  <input className="input" required maxLength={100} value={form.full_name} onChange={(e) => updateForm('full_name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" className="input" required maxLength={150} autoComplete="off" value={form.email} onChange={(e) => updateForm('email', e.target.value)} />
                </div>
              </div>
              <div className="form-grid-3 form-grid">
                <div className="field">
                  <label>Temporary password</label>
                  <input type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => updateForm('password', e.target.value)} />
                  <span className="field-hint">8 to 72 characters. Share it with the person privately.</span>
                </div>
                <div className="field">
                  <label>Role</label>
                  <select className="input" value={form.role_name} onChange={(e) => updateForm('role_name', e.target.value)}>
                    {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {form.role_name === ROLES.BOTANIST && (
                  <div className="field">
                    <label>Botanist type</label>
                    <select className="input" value={form.botanist_type} onChange={(e) => updateForm('botanist_type', e.target.value)}>
                      {BOTANIST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="field-hint">External botanists send edit requests instead of editing directly.</span>
                  </div>
                )}
              </div>
              <div>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Botanist type</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.user_id === user.user_id;
                  return (
                    <tr key={u.user_id}>
                      <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                      <td className="muted">{u.email}</td>
                      <td>
                        <select
                          className="input"
                          value={u.role_name}
                          disabled={self}
                          onChange={(e) => changeRole(u, e.target.value)}
                          style={{ width: 200 }}
                        >
                          {ROLE_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        {u.role_name === ROLES.BOTANIST ? (
                          <select
                            className="input"
                            value={u.botanist_type || ''}
                            onChange={(e) => changeType(u, e.target.value)}
                            style={{ width: 130 }}
                          >
                            {!u.botanist_type && <option value="" disabled>Not set</option>}
                            {BOTANIST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={u.is_active ? 'tag tag-approved' : 'tag tag-rejected'}>
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td>
                        {resetting === u.user_id ? (
                          <form className="row-actions" onSubmit={(e) => submitReset(e, u)}>
                            <input type="text" className="input" required minLength={8} maxLength={72} autoComplete="off"
                              placeholder="Temporary password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} style={{ width: 180 }} />
                            <button type="submit" className="btn btn-primary btn-sm">Save</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResetting(null); setTempPassword(''); }}>Cancel</button>
                          </form>
                        ) : (
                          <div className="row-actions">
                            <button className="btn btn-outline btn-sm" disabled={self} onClick={() => toggleActive(u)}>
                              {u.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button className="btn btn-outline btn-sm" disabled={self} title={self ? 'Use My Account to change your own password' : ''}
                              onClick={() => { setResetting(u.user_id); setTempPassword(''); }}>
                              Reset password
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr className="empty-row"><td colSpan="6">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
      </>


    </div>
  );
}
