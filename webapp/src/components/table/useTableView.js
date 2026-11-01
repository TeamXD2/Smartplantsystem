import { useCallback, useEffect, useMemo, useState } from 'react';

// Sorting, filtering, searching, paging and row selection for a list that is
// already in memory. The page supplies how to read each sortable column, how a
// row matches the search box, and one test per filter.
//
//   const t = useTableView({
//     rows, rowId: (r) => r.id, defaultSort: { key: 'date', dir: 'desc' },
//     sorters: { name: (r) => r.name, date: (r) => r.created_at },
//     searchText: (r) => `${r.name} ${r.email}`,
//     filters: { status: (r, value) => r.status === value },
//   });
function compare(a, b) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;   // empty values always sink to the bottom
  if (bEmpty) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function useTableView({ rows, rowId, defaultSort = null, sorters = {}, searchText, filters = {}, initialSearch = '', initialFilters = {}, initialPageSize = 25 }) {
  const [search, setSearch] = useState(initialSearch);
  const [values, setValues] = useState(initialFilters);
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState(() => new Set());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let list = rows.filter((row) => {
      if (needle && !searchText(row).toLowerCase().includes(needle)) return false;
      return Object.entries(values).every(([key, value]) => value === '' || value === false || value == null || !filters[key] || filters[key](row, value));
    });
    if (sort && sorters[sort.key]) {
      const read = sorters[sort.key];
      const factor = sort.dir === 'desc' ? -1 : 1;
      // Decorate with the original index so equal values keep a stable order.
      list = list
        .map((row, index) => ({ row, index, value: read(row) }))
        .sort((x, y) => {
          const aEmpty = x.value === null || x.value === undefined || x.value === '';
          const bEmpty = y.value === null || y.value === undefined || y.value === '';
          if (aEmpty !== bEmpty) return aEmpty ? 1 : -1; // empties last in both directions
          return compare(x.value, y.value) * factor || x.index - y.index;
        })
        .map((x) => x.row);
    }
    return list;
  }, [rows, search, values, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);

  // Back to page 1 whenever what is shown changes.
  useEffect(() => { setPage(1); }, [search, values, sort, pageSize]);

  // Forget selected rows that no longer exist (after a delete or a reload).
  useEffect(() => {
    setSelected((current) => {
      const ids = new Set(rows.map(rowId));
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback((key, value) => setValues((v) => ({ ...v, [key]: value })), []);
  const clearFilters = useCallback(() => { setSearch(''); setValues({}); }, []);

  const toggleSort = useCallback((key) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: 'asc' };
      if (current.dir === 'asc') return { key, dir: 'desc' };
      return defaultSort && defaultSort.key !== key ? defaultSort : null;
    });
  }, [defaultSort]);

  const toggleRow = useCallback((id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);

  const pageIds = pageRows.map(rowId);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  const togglePage = useCallback(() => setSelected((current) => {
    const next = new Set(current);
    if (pageIds.every((id) => next.has(id))) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    return next;
  }), [pageIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectAllMatching = useCallback(() => setSelected(new Set(filtered.map(rowId))), [filtered]); // eslint-disable-line react-hooks/exhaustive-deps
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedRows = useMemo(() => rows.filter((r) => selected.has(rowId(r))), [rows, selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeFilters = Object.entries(values).filter(([, v]) => v !== '' && v !== false && v != null).length + (search.trim() ? 1 : 0);

  const snapshot = useCallback(() => ({ search, values, sort }), [search, values, sort]);
  const applySnapshot = useCallback((s) => {
    setSearch(s.search || '');
    setValues(s.values || {});
    setSort(s.sort || defaultSort);
  }, [defaultSort]);

  return {
    search, setSearch, values, setFilter, clearFilters, activeFilters,
    sort, toggleSort, page: safePage, setPage, pageSize, setPageSize, pages,
    filtered, pageRows, total: rows.length,
    selected, selectedRows, toggleRow, togglePage, allOnPage, someOnPage, selectAllMatching, clearSelection,
    snapshot, applySnapshot,
  };
}
