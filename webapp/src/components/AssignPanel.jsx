import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { fetchAssignments, assignBotanist, unassignBotanist } from '../queries/plants';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Skeleton } from './ui/Skeleton';
import { relativeTime, exactTime } from '../hooks';

// Officer / Admin: choose which External Botanists may see this plant's full record
// (GET/POST/DELETE /api/plants/:id/assignments). Everyone else on staff already sees
// every record, so only External Botanists are listed.
export default function AssignPanel({ plantId }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null); // botanist id being assigned / removed

  const load = useCallback(() => {
    return fetchAssignments(plantId).then(setData).catch((err) => setError(err.message));
  }, [plantId]);

  useEffect(() => { load(); }, [load]);

  async function run(id, action, success) {
    setBusy(id);
    try {
      const res = await action();
      toast.success(res.message || success);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(b) {
    if (b.registered_plant) {
      const ok = await confirm({
        title: `Remove ${b.full_name}?`,
        message: 'They registered this plant. Without the assignment they will only see what park visitors see.',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
    }
    run(b.botanist_id, () => unassignBotanist(plantId, b.botanist_id), 'Assignment removed.');
  }

  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!data) return <Skeleton height={120} />;

  const q = query.trim().toLowerCase();
  const matches = data.available.filter((u) => !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  return (
    <div className="assign">
      <section>
        <h4 className="assign-title">Assigned External Botanists ({data.assigned.length})</h4>
        {data.assigned.length === 0 ? (
          <p className="muted">Nobody yet. External Botanists only see what park visitors see.</p>
        ) : (
          <ul className="history-list">
            {data.assigned.map((b) => (
              <li key={b.botanist_id}>
                <div>
                  <strong>{b.full_name}</strong>{' '}
                  {b.registered_plant && <span className="tag tag-approved">Registered this plant</span>}{' '}
                  {!b.is_active && <span className="tag tag-offline">Deactivated</span>}
                  <div className="muted assign-small">
                    {b.email} · assigned by {b.assigned_by_name || 'unknown'} <time dateTime={b.assigned_at} title={exactTime(b.assigned_at)}>{relativeTime(b.assigned_at)}</time>
                  </div>
                </div>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy !== null} onClick={() => remove(b)}>
                  {busy === b.botanist_id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="assign-title">Assign another</h4>
        <label className="assign-search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder="Filter by name or email"
            aria-label="Filter External Botanists by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {data.available.length === 0 ? (
          <p className="muted">Every active External Botanist is already assigned.</p>
        ) : matches.length === 0 ? (
          <p className="muted">No External Botanist matches “{query}”.</p>
        ) : (
          <ul className="history-list assign-options">
            {matches.map((u) => (
              <li key={u.user_id}>
                <div>
                  <strong>{u.full_name}</strong>
                  <div className="muted assign-small">{u.email}</div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => run(u.user_id, () => assignBotanist(plantId, u.user_id), 'Assigned.')}>
                  {busy === u.user_id ? 'Assigning…' : 'Assign'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
