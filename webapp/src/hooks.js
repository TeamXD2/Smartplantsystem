import { useEffect, useState } from 'react';

// Returns `value` only after it has stopped changing for `delay` ms, so typing in
// a search box doesn't send one request per keystroke.
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
