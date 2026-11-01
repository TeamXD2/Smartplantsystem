import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, ClipboardCheck, SearchX, RefreshCw } from 'lucide-react';
import { fetchRequests, reviewRequest } from '../queries/requests';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationsContext';
import { relativeTime, exactTime } from '../hooks';
import { runBulk, plural } from '../utils/bulk';
import { useTableView } from './table/useTableView';
import { useSavedViews } from './table/useSavedViews';
import { BulkBar, FilterSelect, Pager, RowCheck, SavedViewsMenu, SortTh, TableToolbar } from './table/TableParts';
import StatusTag from './StatusTag';
import ChangesList from './ChangesList';
import ReviewDialog from './ReviewDialog';
import EmptyState from './ui/EmptyState';
import { SkeletonRows } from './ui/Skeleton';

// Officer / Admin: edit and delete requests from Botanists. Approving applies the
// change automatically (the backend does it and writes the audit trail).
const SORTERS = {
  plant: (r) => (r.plant_scientific_name_snapshot || '').toLowerCase(),
  type: (r) => r.request_type,
  by: (r) => r.requested_by_name,
  status: (r) => r.status,
  sent: (r) => new Date(r.requested_at).getTime(),
};
const DEFAULT_SORT = { key: 'sent', dir: 'desc' };
const PRESETS = [
  { id: 'p-pending', name: 'Waiting for a decision', state: { search: '', values: { status: 'Pending' } } },
  { id: 'p-deletes', name: 'Pending deletions', state: { search: '', values: { status: 'Pending', type: 'DELETE' } } },
  { id: 'p-edits', name: 'Pending edits', state: { search: '', values: { status: 'Pending', type: 'EDIT' } } },
  { id: 'p-all', name: 'Everything', state: { search: '', values: {} } },
];

export default function ChangeRequestsPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const notifications = useNotifications();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null); // { decision, requests }
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchRequests(''));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const t = useTableView({
    rows,
    rowId: (r) => r.request_id,
    defaultSort: DEFAULT_SORT,
    sorters: SORTERS,
    initialFilters: { status: 'Pending' },
    searchText: (r) => [r.plant_scientific_name_snapshot, r.plant_qr_code_snapshot, r.requested_by_name, r.review_comment].filter(Boolean).join(' '),
    filters: {
      status: (r, v) => r.status === v,
      type: (r, v) => r.request_type === v,
      by: (r, v) => r.requested_by_name === v,
    },
  });
  const saved = useSavedViews(`requests_${user.user_id}`, PRESETS);

  const counts = useMemo(() => {
    const c = { Pending: 0, Approved: 0, Rejected: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);
  const people = useMemo(() => [...new Set(rows.map((r) => r.requested_by_name).filter(Boolean))].sort(), [rows]);
  const status = t.values.status || '';

  const selectedPending = t.selectedRows.filter((r) => r.status === 'Pending');

  async function submitReview(comment) {
    setBusy(true);
    const items = review.requests;
    setProgress({ done: 0, total: items.length });
    const { done, failed } = await runBulk(items, (r) => reviewRequest(r.request_id, review.decision, comment), (d, total) => setProgress({ done: d, total }));
    setBusy(false);
    setProgress(null);
    const verb = review.decision === 'Approved' ? 'Approved' : 'Rejected';
    setReview(null);
    t.clearSelection();
    await load();
    notifications.refresh();
    if (failed.length === 0) toast.success(`${verb} ${plural(done.length, 'request')}.`);
    else toast.error(`${verb} ${done.length} of ${items.length} requests.`, { detail: `${failed.length} failed: ${failed[0].message}` });
  }

  const tabs = [['Pending', counts.Pending], ['Approved', counts.Approved], ['Rejected', counts.Rejected], ['', rows.length]];

  return (
    <div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button type="button" className="link-btn" onClick={load}><RefreshCw size={13} aria-hidden="true" /> Try again</button>
        </div>
      )}

      <div className="segmented segmented-tabs" role="group" aria-label="Request status">
        {tabs.map(([value, count]) => (
          <button key={value || 'all'} type="button" aria-pressed={status === value} onClick={() => t.setFilter('status', value)}>
            {value || 'All'} <span className="count">{count}</span>
          </button>
        ))}
      </div>

      <TableToolbar
        search={t.search}
        onSearch={t.setSearch}
        placeholder="Search plant, QR code or requester"
        searchLabel="Search requests"
        activeFilters={t.activeFilters}
        onClear={t.clearFilters}
        views={(
          <SavedViewsMenu
            views={saved.views}
            onApply={t.applySnapshot}
            onSave={(name) => { const v = saved.save(name, t.snapshot()); if (v) toast.success(`View “${v.name}” saved on this browser.`); return v; }}
            onRemove={saved.remove}
            canSave={t.activeFilters > 0}
          />
        )}
      >
        <FilterSelect label="Request type" allLabel="Edits and deletions" value={t.values.type} onChange={(v) => t.setFilter('type', v)} options={[['EDIT', 'Edits'], ['DELETE', 'Deletions']]} />
        <FilterSelect label="Requested by" allLabel="Anyone" value={t.values.by} onChange={(v) => t.setFilter('by', v)} options={people} />
      </TableToolbar>

      <div className="list-meta"><span role="status">{loading ? 'Loading requests…' : `${t.filtered.length} of ${t.total} requests`}</span></div>

      {loading ? <SkeletonRows rows={5} columns={5} label="Loading requests" /> : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Change requests. Use the column headings to sort.</caption>
            <thead>
              <tr>
                <th scope="col" className="col-check"><RowCheck checked={t.allOnPage} indeterminate={t.someOnPage} onChange={t.togglePage} label="Select all requests on this page" /></th>
                <SortTh label="Plant" sortKey="plant" sort={t.sort} onSort={t.toggleSort} />
                <SortTh label="Request" sortKey="type" sort={t.sort} onSort={t.toggleSort} />
                <SortTh label="Requested by" sortKey="by" sort={t.sort} onSort={t.toggleSort} className="hide-sm" />
                <SortTh label="Status" sortKey="status" sort={t.sort} onSort={t.toggleSort} />
                <SortTh label="Sent" sortKey="sent" sort={t.sort} onSort={t.toggleSort} className="hide-md" />
                <th scope="col" className="col-actions"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {t.pageRows.map((r) => (
                <tr key={r.request_id} className={t.selected.has(r.request_id) ? 'is-selected' : ''}>
                  <td className="col-check"><RowCheck checked={t.selected.has(r.request_id)} onChange={() => t.toggleRow(r.request_id)} label={`Select request for ${r.plant_scientific_name_snapshot}`} /></td>
                  <td>
                    <div className="sn-sci sn-sci-strong">{r.plant_scientific_name_snapshot}</div>
                    <span className="id-tag">{r.plant_qr_code_snapshot}</span>
                  </td>
                  <td>
                    {r.request_type === 'DELETE'
                      ? <strong className="req-delete">Delete this record</strong>
                      : <ChangesList changes={r.proposed_changes} />}
                  </td>
                  <td className="hide-sm">{r.requested_by_name}</td>
                  <td>
                    <StatusTag status={r.status} />
                    {r.review_comment && <div className="cell-sub">“{r.review_comment}”</div>}
                  </td>
                  <td className="hide-md"><time dateTime={r.requested_at} title={exactTime(r.requested_at)}>{relativeTime(r.requested_at)}</time></td>
                  <td className="col-actions">
                    {r.status === 'Pending' && (
                      <div className="row-actions">
                        <button type="button" className="btn btn-forest btn-sm" onClick={() => setReview({ decision: 'Approved', requests: [r] })}><Check size={15} aria-hidden="true" /> Approve</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setReview({ decision: 'Rejected', requests: [r] })}><X size={15} aria-hidden="true" /> Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {t.filtered.length === 0 && !error && (
            t.total === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No requests yet">When a Botanist asks to edit or delete a record, it shows up here for you to decide.</EmptyState>
            ) : status === 'Pending' && t.activeFilters === 1 ? (
              <EmptyState icon={ClipboardCheck} title="You're all caught up">No requests are waiting for a decision.</EmptyState>
            ) : (
              <EmptyState icon={SearchX} title="No requests match these filters" action={<button type="button" className="btn btn-outline" onClick={t.clearFilters}>Clear filters</button>}>Try a different status or search.</EmptyState>
            )
          )}
        </div>
      )}

      <BulkBar count={t.selected.size} matching={t.filtered.length} onSelectAll={t.selectAllMatching} onClear={t.clearSelection} busy={busy} progress={progress}>
        {selectedPending.length > 0 ? (
          <>
            <button type="button" className="btn btn-forest btn-sm" onClick={() => setReview({ decision: 'Approved', requests: selectedPending })}><Check size={15} aria-hidden="true" /> Approve {selectedPending.length}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setReview({ decision: 'Rejected', requests: selectedPending })}><X size={15} aria-hidden="true" /> Reject {selectedPending.length}</button>
            {selectedPending.length < t.selected.size && <span className="bulk-note">{t.selected.size - selectedPending.length} already decided, skipped</span>}
          </>
        ) : <span className="bulk-note">Only pending requests can be approved or rejected.</span>}
      </BulkBar>

      <Pager page={t.page} pageSize={t.pageSize} total={t.filtered.length} onPage={t.setPage} onPageSize={t.setPageSize} noun="requests" />
      <ReviewDialog open={Boolean(review)} decision={review ? review.decision : 'Approved'} requests={review ? review.requests : []} busy={busy} onClose={() => setReview(null)} onSubmit={submitReview} />
    </div>
  );
}
