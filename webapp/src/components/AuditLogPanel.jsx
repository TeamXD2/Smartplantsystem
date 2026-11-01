import { useCallback, useEffect, useState } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';
import { fetchAuditLogs } from '../queries/account';
import { FilterSelect } from './table/TableParts';
import Pager from './Pager';
import EmptyState from './ui/EmptyState';
import { SkeletonRows } from './ui/Skeleton';
import { relativeTime, exactTime } from '../hooks';

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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAuditLogs({ action, page, limit: LIMIT }));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [action]);

  const first = loading && data.logs.length === 0;

  return (
    <div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button type="button" className="link-btn" onClick={load}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}
      <div className="toolbar">
        <FilterSelect label="Action" allLabel="All actions" value={action} onChange={setAction} options={data.actions.map((a) => [a, label(a)])} />
        <span className="muted" role="status">{first ? 'Loading…' : `${data.total} entries`}</span>
        {action && <div className="toolbar-end"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAction('')}>Clear filter</button></div>}
      </div>
      {first ? <SkeletonRows rows={8} columns={5} label="Loading the audit log" /> : (
        <div className="table-wrap" aria-busy={loading}>
          <table className="data-table">
            <caption className="sr-only">Audit log, newest first</caption>
            <thead>
              <tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col" className="hide-sm">Target</th><th scope="col" className="hide-md">Details</th></tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.log_id}>
                  <td className="nowrap"><time dateTime={log.created_at} title={exactTime(log.created_at)}>{relativeTime(log.created_at)}</time></td>
                  <td>
                    <div className="cell-strong">{log.user_name || 'System'}</div>
                    {log.user_email && <div className="cell-sub">{log.user_email}</div>}
                  </td>
                  <td>{label(log.action)}</td>
                  <td className="hide-sm muted">{target(log)}</td>
                  <td className="hide-md muted small">{details(log.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.logs.length === 0 && !error && (
            <EmptyState icon={ScrollText} title={action ? 'No entries for this action' : 'Nothing recorded yet'}>
              {action ? 'Try another action, or clear the filter.' : 'Activity appears here as people sign in and change records.'}
            </EmptyState>
          )}
        </div>
      )}
      <Pager page={page} limit={LIMIT} total={data.total} onChange={setPage} noun="entries" />
    </div>
  );
}
