// Previous / next for the server-paged lists (the audit log and the public
// catalog), where only one page is loaded at a time.
export default function Pager({ page, limit, total, onChange, noun = 'records' }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="pager-count">Showing {from}–{to} of {total} {noun}</span>
      <div className="pager-controls">
        <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <span className="pager-page" aria-current="page">Page {page} of {pages}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
