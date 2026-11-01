import { useCallback, useMemo } from 'react';
import { useLocalStorage } from '../../hooks';

// Named combinations of search + filters + sort that a person can come back to.
// `presets` are built in and cannot be deleted; the rest live in this browser.
export function useSavedViews(storageKey, presets = []) {
  const [custom, setCustom] = useLocalStorage(`rt_views_${storageKey}`, []);

  const save = useCallback((name, snapshot) => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return null;
    const view = { id: `v${Date.now()}`, name: clean, state: snapshot };
    // Saving under an existing name replaces that view.
    setCustom((list) => [...list.filter((v) => v.name.toLowerCase() !== clean.toLowerCase()), view]);
    return view;
  }, [setCustom]);

  const remove = useCallback((id) => setCustom((list) => list.filter((v) => v.id !== id)), [setCustom]);

  const views = useMemo(() => [
    ...presets.map((p) => ({ ...p, preset: true })),
    ...custom,
  ], [presets, custom]);

  return { views, save, remove };
}
