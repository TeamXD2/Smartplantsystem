import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Keyboard, LogOut, PlusCircle, Search, Leaf } from 'lucide-react';
import Dialog from '../ui/Dialog';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../roles';
import { menuFor } from '../../nav';
import { fetchPlants } from '../../queries/plants';
import { useDebounced } from '../../hooks';

// Global search (Ctrl/⌘ + K, or "/"): jump to a page, run an action, or find a
// species record. Arrow keys move, Enter opens, Escape closes.
export default function CommandPalette({ open, onClose, onShowShortcuts }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const botanist = user.role_name === ROLES.BOTANIST;
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [plants, setPlants] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounced(query, 250);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setPlants([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    const text = debounced.trim();
    if (!open || text.length < 2) {
      setPlants([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    fetchPlants({ search: text, limit: 6, mine: botanist ? 'true' : undefined })
      .then((d) => !cancelled && setPlants(d.plants))
      .catch(() => !cancelled && setPlants([]))
      .finally(() => !cancelled && setSearching(false));
    return () => { cancelled = true; };
  }, [debounced, open, botanist]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text) => !needle || text.toLowerCase().includes(needle);
    const go = (to) => () => navigate(to);

    const species = plants.map((p) => ({
      id: `plant-${p.plant_id}`,
      label: p.common_name || p.scientific_name,
      sub: p.common_name ? p.scientific_name : null,
      tag: p.qr_code,
      icon: Leaf,
      run: go(`/records?q=${encodeURIComponent(p.scientific_name)}`),
    }));
    const pages = menuFor(user)
      .filter((item) => matches(`${item.label} ${item.keywords}`))
      .map((item) => ({ id: `page-${item.to}`, label: item.label, icon: item.icon, hint: `g ${item.shortcut}`, run: go(item.to) }));
    const actions = [
      !botanist && { id: 'act-add', label: 'Add a species record', icon: PlusCircle, run: go('/records?new=1') },
      { id: 'act-keys', label: 'Show keyboard shortcuts', icon: Keyboard, hint: '?', run: onShowShortcuts },
      { id: 'act-out', label: 'Log out', icon: LogOut, run: () => { logout(); navigate('/'); } },
    ].filter(Boolean).filter((a) => matches(a.label));

    return [
      species.length > 0 && { title: 'Species', items: species },
      pages.length > 0 && { title: 'Go to', items: pages },
      actions.length > 0 && { title: 'Actions', items: actions },
    ].filter(Boolean);
  }, [query, plants, user, botanist, navigate, logout, onShowShortcuts]);

  const flat = groups.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => { setActive(0); }, [query, plants]);
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('[aria-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [current]);

  function choose(item) {
    onClose();
    // Let the dialog hand focus back first so a page change doesn't fight it.
    setTimeout(() => item.run(), 0);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % Math.max(1, flat.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + flat.length) % Math.max(1, flat.length)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(flat.length - 1); }
    else if (e.key === 'Enter' && flat[current]) { e.preventDefault(); choose(flat[current]); }
  }

  let index = -1;
  return (
    <Dialog open={open} onClose={onClose} hideHeader label="Search" size="palette" initialFocusRef={inputRef}>
      <div className="palette" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={flat[current] ? `opt-${flat[current].id}` : undefined}
            aria-label="Search pages, actions and species"
            placeholder={botanist ? 'Search pages and your plants…' : 'Search pages and species…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" ref={listRef} className="palette-list" aria-label="Results">
          {groups.map((group) => (
            <li key={group.title} role="presentation">
              <div className="menu-label" role="presentation">{group.title}</div>
              <ul role="presentation">
                {group.items.map((item) => {
                  index += 1;
                  const mine = index;
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.id}
                      id={`opt-${item.id}`}
                      role="option"
                      aria-selected={mine === current}
                      className={`palette-item ${mine === current ? 'active' : ''}`}
                      onMouseMove={() => setActive(mine)}
                      onClick={() => choose(item)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span className="palette-label">{item.label}{item.sub && <em>{item.sub}</em>}</span>
                      {item.tag && <span className="id-tag">{item.tag}</span>}
                      {item.hint && <kbd>{item.hint}</kbd>}
                      {mine === current && <CornerDownLeft size={14} aria-hidden="true" className="palette-enter" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {flat.length === 0 && (
            <li role="presentation" className="palette-empty">
              {searching ? 'Searching…' : query.trim().length < 2 ? 'Nothing matches. Keep typing to search species.' : `No species or pages match “${query.trim()}”.`}
            </li>
          )}
        </ul>
        <div className="palette-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </Dialog>
  );
}
