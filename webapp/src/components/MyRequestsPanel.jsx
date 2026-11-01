import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { fetchMyRequests } from '../queries/requests';
import { useNotifications } from '../context/NotificationsContext';
import { relativeTime, exactTime } from '../hooks';
import { useTableView } from './table/useTableView';
import { Pager, SortTh } from './table/TableParts';
import StatusTag from './StatusTag';
import ChangesList from './ChangesList';
import EmptyState from './ui/EmptyState';
import { SkeletonRows } from './ui/Skeleton';

// A Botanist's own edit / delete requests, with the Officer's decision and comment.
const SORTERS = {
  plant: (r) => (r.plant_scientific_name_snapshot || '').toLowerCase(),
  status: (r) => r.status,
  sent: (r) => new Date(r.requested_at).getTime(),
};

export default function MyRequestsPanel() {
  const notifications = useNotifications();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => fetchMyRequests()
    .then((r) => { setRows(r); setError(''); })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  // Looking at your requests counts as having seen the decisions.
  useEffect(() => { if (!loading && !error) notifications.markSeen(); }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = useTableView({
    rows,
    rowId: (r) => r.request_id,
    defaultSort: { key: 'sent', dir: 'desc' },
    sorters: SORTERS,
    searchText: () => '',
    filters: { status: (r, v) => r.status === v },
  });
  const counts = useMemo(() => {
    const c = { Pending: 0, Approved: 0, Rejected: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);
  const status = t.values.status || '';

  return (
    <div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button type="button" className="link-btn" onClick={load}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}
      <div className="segmented segmented-tabs" role="group" aria-label="Request status">
        {[['', 'All', rows.length], ['Pending', 'Pending', counts.Pending], ['Approved', 'Approved', counts.Approved], ['Rejected', 'Rejected', counts.Rejected]].map(([value, label, count]) => (
          <button key={label} type="button" aria-pressed={status === value} onClick={() => t.setFilter('status', value)}>{label} <span className="count">{count}</span></button>
        ))}
      </div>

      {loading ? <SkeletonRows rows={4} columns={5} label="Loading your requests" /> : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">My requests. Use the column headings to sort.</caption>
            <thead>
              <tr>
                <SortTh label="Plant" sortKey="plant" sort={t.sort} onSort={t.toggleSort} />
                <th scope="col">Request</th>
                <SortTh label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />
                <th scope="col" className="hide-sm">Officer's comment</th>
                <SortTh label="Sent" sortKey="sent" sort={t.sort} onSort={t.toggleSort} className="hide-md" />
              </tr>
            </thead>
            <tbody>
              {t.pageRows.map((r) => (
                <tr key={r.request_id}>
                  <td>
                    <div className="sn-sci sn-sci-strong">{r.plant_scientific_name_snapshot}</div>
                    <span className="id-tag">{r.plant_qr_code_snapshot}</span>
                  </td>
                  <td>{r.request_type === 'DELETE' ? 'Delete this record' : <ChangesList changes={r.proposed_changes} />}</td>
                  <td><StatusTag status={r.status} /></td>
                  <td className="hide-sm">
                    {r.review_comment || <span className="muted">—</span>}
                    {r.reviewed_by_name && <div className="cell-sub">by {r.reviewed_by_name}</div>}
                  </td>
                  <td className="hide-md"><time dateTime={r.requested_at} title={exactTime(r.requested_at)}>{relativeTime(r.requested_at)}</time></td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.filtered.length === 0 && !error && (
            <EmptyState icon={ClipboardCheck} title={rows.length === 0 ? "You haven't sent any requests" : `No ${status.toLowerCase()} requests`}>
              {rows.length === 0 ? 'External Botanists ask for edits here, and anyone can ask for a record to be deleted from My records.' : 'Try another status.'}
            </EmptyState>
          )}
        </div>
      )}
      <Pager page={t.page} pageSize={t.pageSize} total={t.filtered.length} onPage={t.setPage} onPageSize={t.setPageSize} noun="requests" />
    </div>
  );
}
