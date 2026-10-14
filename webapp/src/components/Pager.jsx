// Previous / next for the paged list endpoints (?page=&limit=).
export default function Pager({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  return (
    <div className="row-actions" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
      <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span className="muted">Page {page} of {pages} · {total} records</span>
      <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
