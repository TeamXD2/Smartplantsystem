import { useEffect, useState } from 'react';
import { fetchUsers, updateUser } from '../queries/users';
import { useAuth } from '../context/AuthContext';
import PlantRecordsTable from '../components/PlantRecordsTable';

const ROLES = ['botanist', 'conservation_officer', 'admin'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('users');

  async function load() {
    try {
      setUsers(await fetchUsers());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeRole(id, role) {
    try {
      await updateUser(id, { role });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(id, is_active) {
    try {
      await updateUser(id, { is_active: !is_active });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container page">
      <h2>Admin Dashboard</h2>

      <div className="tabs">
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          User Accounts
        </button>
        <button className={`tab ${tab === 'records' ? 'active' : ''}`} onClick={() => setTab('records')}>
          Species Records
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {tab === 'users' ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <select
                      className="input"
                      value={u.role}
                      disabled={u.id === user.id}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      style={{ width: 180 }}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={u.is_active ? 'tag tag-approved' : 'tag tag-rejected'}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={u.id === user.id}
                      onClick={() => toggleActive(u.id, u.is_active)}
                    >
                      {u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr className="empty-row"><td colSpan="5">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <PlantRecordsTable />
      )}
    </div>
  );
}
