import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, BookmarkPlus, Check, Search, SlidersHorizontal, Trash2, X, FilterX } from 'lucide-react';
import Popover from '../ui/Popover';

// Sortable column heading. The whole heading is a button; aria-sort tells screen
// readers the current order.
export function SortTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort && sort.key === sortKey;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button type="button" className={`sort-btn ${active ? 'active' : ''}`} onClick={() => onSort(sortKey)}>
        {label} <Icon size={14} aria-hidden="true" />
      </button>
    </th>
  );
}

export function RowCheck({ checked, indeterminate, onChange, label }) {
  return (
    <input
      type="checkbox"
      className="check"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = Boolean(indeterminate) && !checked; }}
      onChange={onChange}
      aria-label={label}
    />
  );
}

// Search box + the page's filter controls (children) + saved views + "clear".
export function TableToolbar({ search, onSearch, placeholder, activeFilters, onClear, views, children, searchLabel = 'Search' }) {
  const id = useId();
  const filtersId = useId();
  const [open, setOpen] = useState(false);
  // Filters beyond the search box (the search itself counts as one active filter)
  const filterCount = activeFilters - (search.trim() ? 1 : 0);
  return (
    <div className="toolbar" role="search">
      <div className="search-box">
        <Search size={16} aria-hidden="true" />
        <label htmlFor={id} className="sr-only">{searchLabel}</label>
        <input id={id} className="input" type="search" placeholder={placeholder} value={search} onChange={(e) => onSearch(e.target.value)} />
        {search && (
          <button type="button" className="search-clear" onClick={() => onSearch('')} aria-label="Clear search"><X size={15} /></button>
        )}
      </div>
      {children && (
        <button type="button" className="btn btn-outline btn-sm filters-toggle" aria-expanded={open} aria-controls={filtersId} onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Filters{filterCount > 0 ? ` (${filterCount})` : ''}
        </button>
      )}
      {children && <div id={filtersId} className="toolbar-filters" data-open={open}>{children}</div>}
      <div className="toolbar-end">
        {activeFilters > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}><FilterX size={15} /> Clear filters</button>
        )}
        {views}
      </div>
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, allLabel }) {
  const id = useId();
  return (
    <div className="filter">
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} className={`input ${value ? 'is-set' : ''}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{allLabel || label}</option>
        {options.map((o) => {
          const [val, text] = Array.isArray(o) ? o : [o, o];
          return <option key={val} value={val}>{text}</option>;
        })}
      </select>
    </div>
  );
}

export function FilterChip({ label, active, onChange, count }) {
  return (
    <button type="button" className={`chip ${active ? 'on' : ''}`} aria-pressed={active} onClick={() => onChange(!active)}>
      {active && <Check size={14} aria-hidden="true" />} {label}{count != null ? ` (${count})` : ''}
    </button>
  );
}

// "Views" menu: apply a built-in or saved view, or save the current one by name.
export function SavedViewsMenu({ views, onApply, onSave, onRemove, canSave }) {
  const [name, setName] = useState('');
  const nameId = useId();
  return (
    <Popover
      label="Saved views"
      panelClassName="views-panel"
      renderTrigger={({ toggle, ref, props }) => (
        <button type="button" ref={ref} className="btn btn-outline btn-sm" onClick={toggle} {...props}><Bookmark size={15} /> Views</button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="menu-label">Saved views</div>
          <ul className="views-list">
            {views.map((v) => (
              <li key={v.id}>
                <button type="button" className="menu-item" onClick={() => { onApply(v.state); close(); }}>{v.name}</button>
                {!v.preset && (
                  <button type="button" className="icon-btn" onClick={() => onRemove(v.id)} aria-label={`Delete view ${v.name}`}><Trash2 size={15} /></button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="views-save"
            onSubmit={(e) => {
              e.preventDefault();
              if (onSave(name)) setName('');
            }}
          >
            <label htmlFor={nameId} className="menu-label">Save what you see now</label>
            <div className="views-save-row">
              <input id={nameId} className="input" maxLength={40} placeholder="Name this view" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim() || !canSave}><BookmarkPlus size={15} /> Save</button>
            </div>
          </form>
        </div>
      )}
    </Popover>
  );
}

// Appears when rows are ticked: how many, the actions, and a way to select the rest.
export function BulkBar({ count, matching, onSelectAll, onClear, busy, progress, children }) {
  if (count === 0) return null;
  return (
    <div className="bulk-bar" role="region" aria-label="Actions for selected rows">
      <div className="bulk-count" role="status">
        {busy && progress ? `Working… ${progress.done} of ${progress.total}` : `${count} selected`}
        {!busy && matching > count && (
          <button type="button" className="link-btn" onClick={onSelectAll}>Select all {matching}</button>
        )}
      </div>
      <div className="bulk-actions">{children}</div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClear} disabled={busy}><X size={15} /> Clear</button>
    </div>
  );
}

// Page numbers with "Showing 1–25 of 140" and a page-size choice.
export function Pager({ page, pageSize, total, onPage, onPageSize, noun = 'records' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  if (total <= (onPageSize ? 10 : pageSize)) {
    return total > 0 ? <p className="pager-count">Showing {total} {total === 1 ? noun.replace(/s$/, '') : noun}</p> : null;
  }
  return (
    <nav className="pager" aria-label="Pagination">
      <span className="pager-count">Showing {from}–{to} of {total} {noun}</span>
      <div className="pager-controls">
        {onPageSize && (
          <label className="pager-size">
            <span className="sr-only">Rows per page</span>
            <select className="input" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
            </select>
          </label>
        )}
        <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="pager-page" aria-current="page">Page {page} of {pages}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
