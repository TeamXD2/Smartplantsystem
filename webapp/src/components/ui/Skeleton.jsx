// Grey placeholders shown while data loads, shaped like what will appear, so the
// page doesn't jump. aria-busy tells screen readers the region is still loading.
export function Skeleton({ width, height = 14, radius = 6, style }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 6, columns = 5, label = 'Loading' }) {
  return (
    <div className="table-wrap" aria-busy="true">
      <span className="sr-only" role="status">{label}…</span>
      <table className="data-table">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}><Skeleton width={c === 0 ? '70%' : `${45 + ((r * 7 + c * 13) % 40)}%`} height={c === 0 ? 16 : 12} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div className="grid grid-3" aria-busy="true">
      <span className="sr-only" role="status">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="specimen-card">
          <div className="specimen-photo"><span className="skeleton skeleton-fill" aria-hidden="true" /></div>
          <div className="specimen-body">
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className={`stat-row ${count === 4 ? 'four' : ''}`} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stat"><Skeleton width={48} height={28} radius={8} style={{ margin: '0 auto' }} /><Skeleton width="55%" height={11} style={{ margin: '10px auto 0' }} /></div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = 200 }) {
  return <div className="panel" aria-busy="true"><span className="sr-only" role="status">Loading…</span><Skeleton width="100%" height={height} radius={10} /></div>;
}
