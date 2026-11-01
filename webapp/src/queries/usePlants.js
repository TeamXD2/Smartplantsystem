import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAllPages, fetchPlants } from './plants';

const MAX_PAGES = 20; // 100 per page: the first 2,000 records

// Every plant the person may see, loaded once and kept in memory so sorting,
// filtering and selecting are instant. `reload()` fetches again after a change.
export function useAllPlants({ mine = false } = {}) {
  const [state, setState] = useState({ rows: [], loading: true, error: '', capped: false });
  const request = useRef(0);

  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const rows = await fetchAllPages(fetchPlants, { mine: mine ? 'true' : undefined }, MAX_PAGES);
      if (id === request.current) setState({ rows, loading: false, error: '', capped: rows.length >= MAX_PAGES * 100 });
    } catch (err) {
      if (id === request.current) setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [mine]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    reload();
  }, [reload]);

  return { ...state, reload };
}
