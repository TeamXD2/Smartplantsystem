import { useEffect, useMemo, useState } from 'react';
import { fetchPlantVersions } from '../queries/plants';
import { BASE_FIELDS, EXTRA_FIELDS, FIELD_LABELS } from '../plantFields';
import { Skeleton } from './ui/Skeleton';
import { exactTime } from '../hooks';

// Every saved version of one plant (GET /api/plants/:id/versions): a timeline on
// the left, the chosen version's full record on the right, with the fields that
// differ from the version it is compared with highlighted.
const FIELDS = [...BASE_FIELDS, ...EXTRA_FIELDS];

const SOURCE_LABELS = {
  REGISTER: 'Original registration',
  EDIT: 'Direct edit',
  REQUEST: 'Approved edit request',
  BACKFILL: 'Saved when versions were introduced',
};

function roleLabel(role, botanistType) {
  if (!role) return '';
  return role === 'Botanist' && botanistType ? `${botanistType} Botanist` : role;
}

function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function same(a, b) {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (isEmpty(a) || isEmpty(b)) return false;
  // Decimals arrive as strings ("50.00"), so compare numbers by value.
  if (!Number.isNaN(Number(a)) && !Number.isNaN(Number(b))) return Number(a) === Number(b);
  return String(a) === String(b);
}

function Value({ value }) {
  return isEmpty(value) ? <span className="muted versions-empty">(empty)</span> : <span className="versions-text">{String(value)}</span>;
}

export default function VersionsPanel({ plantId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [compareTo, setCompareTo] = useState(null);
  const [onlyChanged, setOnlyChanged] = useState(false);

  useEffect(() => {
    fetchPlantVersions(plantId)
      .then((d) => {
        setData(d);
        const latest = d.versions[0];
        if (latest) {
          setSelected(latest.version_no);
          setCompareTo(latest.version_no > 1 ? latest.version_no - 1 : null);
        }
      })
      .catch((err) => setError(err.message));
  }, [plantId]);

  // Versions and rejected requests in one timeline, newest first.
  const timeline = useMemo(() => {
    if (!data) return [];
    return [
      ...data.versions.map((v) => ({ kind: 'version', at: v.created_at, item: v })),
      ...data.rejected_requests.map((r) => ({ kind: 'rejected', at: r.reviewed_at || r.requested_at, item: r })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [data]);

  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!data) return <div aria-busy="true"><Skeleton width="80%" height={14} /><Skeleton width="60%" height={14} style={{ marginTop: 10 }} /></div>;
  if (data.versions.length === 0) return <p className="muted">No versions saved for this plant yet.</p>;

  const byNo = (no) => data.versions.find((v) => v.version_no === no);
  const latestNo = data.versions[0].version_no;
  const version = byNo(selected);
  const other = compareTo ? byNo(compareTo) : null;
  const changed = other ? FIELDS.filter((f) => !same(version[f], other[f])) : [];
  const shown = onlyChanged && other ? FIELDS.filter((f) => changed.includes(f)) : FIELDS;

  function choose(no) {
    setSelected(no);
    setCompareTo(byNo(no - 1) ? no - 1 : null);
    setOnlyChanged(false);
  }

  function countChanges(v) {
    const prev = byNo(v.version_no - 1);
    return prev ? FIELDS.filter((f) => !same(v[f], prev[f])).length : null;
  }

  return (
    <div className="versions">
      <ol className="versions-timeline" aria-label="Versions, newest first">
        {timeline.map(({ kind, item }) => {
          if (kind === 'rejected') {
            const proposed = item.proposed_changes ? Object.entries(item.proposed_changes) : [];
            return (
              <li key={`r${item.request_id}`} className="versions-step is-rejected">
                <span className="versions-dot" aria-hidden="true" />
                <div className="versions-rejected-title">Rejected {item.request_type === 'DELETE' ? 'deletion request' : 'edit request'}</div>
                <div>{item.requested_by_name} <span className="muted versions-small">· {roleLabel(item.requested_by_role, item.requested_by_botanist_type)}</span></div>
                {proposed.length > 0 && (
                  <div className="muted versions-small">
                    {proposed.map(([f, v]) => `${FIELD_LABELS[f] || f} → ${isEmpty(v) ? '(empty)' : v}`).join(', ')}
                  </div>
                )}
                {item.review_comment && <div className="muted versions-small">{item.reviewed_by_name}: “{item.review_comment}”</div>}
                <time className="muted versions-small" dateTime={item.reviewed_at}>{exactTime(item.reviewed_at || item.requested_at)}</time>
              </li>
            );
          }
          const n = countChanges(item);
          const isSelected = item.version_no === selected;
          return (
            <li key={`v${item.version_id}`} className={`versions-step${isSelected ? ' is-selected' : ''}`}>
              <button type="button" className="versions-step-btn" aria-pressed={isSelected} onClick={() => choose(item.version_no)}>
                <span className="versions-dot" aria-hidden="true" />
                <span className="versions-no">v{item.version_no}</span>
                {item.version_no === latestNo && <span className="versions-badge is-current">Current</span>}
                {item.version_no === 1 && item.source === 'REGISTER' && <span className="versions-badge is-original">Original</span>}
                <span className="versions-who">{item.changed_by_name} <span className="muted versions-small">· {roleLabel(item.changed_by_role, item.changed_by_botanist_type)}</span></span>
                <span className="muted versions-small">{SOURCE_LABELS[item.source]} · {exactTime(item.created_at)}</span>
                {n !== null && <span className="versions-count">{n} field{n === 1 ? '' : 's'} changed</span>}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="versions-detail">
        <div className="versions-detail-head">
          <div>
            <h3 className="versions-title">Version {version.version_no}{version.version_no === 1 && version.source === 'REGISTER' ? ' — original record' : ''}</h3>
            <dl className="versions-meta">
              <dt>{['REGISTER', 'BACKFILL'].includes(version.source) ? 'Registered by' : 'Changed by'}</dt>
              <dd>{version.changed_by_name} ({roleLabel(version.changed_by_role, version.changed_by_botanist_type)})</dd>
              {version.approved_by_name && <><dt>Approved by</dt><dd>{version.approved_by_name}</dd></>}
              <dt>Source</dt>
              <dd>{SOURCE_LABELS[version.source]}{version.request_id ? ` (request #${version.request_id})` : ''}</dd>
              <dt>Saved</dt><dd>{exactTime(version.created_at)}</dd>
            </dl>
            {version.note && <p className="versions-note">“{version.note}”</p>}
          </div>
          <div className="versions-controls">
            <label>
              Compare with{' '}
              <select value={compareTo || ''} onChange={(e) => { const v = Number(e.target.value) || null; setCompareTo(v); if (!v) setOnlyChanged(false); }}>
                <option value="">nothing</option>
                {data.versions.filter((v) => v.version_no !== selected).map((v) => (
                  <option key={v.version_id} value={v.version_no}>v{v.version_no}</option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" checked={onlyChanged} disabled={!other} onChange={(e) => setOnlyChanged(e.target.checked)} /> Only changed fields
            </label>
          </div>
        </div>

        <table className="versions-fields">
          <caption className="sr-only">Fields of version {version.version_no}{other ? `, compared with version ${other.version_no}` : ''}</caption>
          <tbody>
            {shown.map((f) => {
              const isChanged = changed.includes(f);
              return (
                <tr key={f} className={isChanged ? 'is-changed' : ''}>
                  <th scope="row">{FIELD_LABELS[f]}</th>
                  <td>
                    {isChanged ? (
                      <>
                        <del className="versions-old"><Value value={other[f]} /></del>
                        <span className="versions-arrow" aria-label="changed to">→</span>
                        <ins className="versions-new"><Value value={version[f]} /></ins>
                      </>
                    ) : <Value value={version[f]} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {other && (
          <p className="muted versions-small versions-summary">
            {changed.length} of {FIELDS.length} fields differ between v{other.version_no} and v{version.version_no}.
          </p>
        )}
      </div>
    </div>
  );
}
