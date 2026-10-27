import { useCallback, useEffect, useState } from 'react';
import { fetchAuditLogs } from '../queries/account';
import Pager from './Pager';

// Admin view of the audit log: every login, plant change, approval and
// account change the backend recorded, newest first.
const LIMIT = 25;

// Plain-English names for the actions the backend writes.
const LABELS = {
  LOGIN: 'Logged in',
  CREATE_USER: 'Created an account',
  UPDATE_USER: 'Changed an account',
  RESET_PASSWORD: 'Reset a password',
  CHANGE_PASSWORD: 'Changed own password',
  CREATE_ADMIN: 'Created the first admin',
  ACKNOWLEDGE_ALERT: 'Acknowledged an IoT alert',
  UPDATE_SENSOR: 'Updated an IoT sensor',
};

function label(action) {
  return LABELS[action] || action.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function target(log) {
  if (!log.target_table) return '—';
  const names = { plants: 'Plant', users: 'User', record_change_requests: 'Request', plant_photos: 'Photo', iot_sensors: 'Sensor', sensor_alerts: 'Alert' };
  return `${names[log.target_table] || log.target_table} #${log.target_id ?? '?'}`;
}

function details(d) {
  if (!d || typeof d !== 'object') return '';
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' · ');
}

export default function AuditLogPanel() {
  const [data, setData] = useState({ logs: [], total: 0, actions: [] });
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await fetchAuditLogs({ action, page, limit: LIMIT }));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [action, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [action]);

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="row-actions" style={{ marginBottom: '1rem' }}>
        <select className="input" value={action} onChange={(e) => setAction(e.target.value)} style={{ width: 260 }}>
          <option value="">All actions</option>
          {data.actions.map((a) => <option key={a} value={a}>{label(a)}</option>)}
        </select>
        <span className="muted">{data.total} entries</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr>
          </thead>
          <tbody>
            {data.logs.map((log) => (
              <tr key={log.log_id}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{log.user_name || 'System'}</div>
                  {log.user_email && <div className="muted" style={{ fontSize: 12 }}>{log.user_email}</div>}
                </td>
                <td>{label(log.action)}</td>
                <td className="muted">{target(log)}</td>
                <td className="muted" style={{ fontSize: 13 }}>{details(log.details)}</td>
              </tr>
            ))}
            {data.logs.length === 0 && <tr className="empty-row"><td colSpan="5">No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} limit={LIMIT} total={data.total} onChange={setPage} />
    </div>
  );
}
