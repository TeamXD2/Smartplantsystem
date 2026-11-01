import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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

// "Species database · RimbaTag" in the browser tab and in screen-reader page changes.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · RimbaTag` : 'RimbaTag';
  }, [title]);
}

// State kept in localStorage (JSON). Falls back to memory when storage is blocked.
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  const set = useCallback((next) => {
    setValue((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // storage full or blocked: keep the in-memory value
      }
      return resolved;
    });
  }, [key]);
  return [value, set];
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab inside `ref` while `active`, focuses it on open and puts focus back
// where it was on close. For dialogs and the mobile menu.
export function useFocusTrap(ref, active, initialFocusRef) {
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const container = ref.current;
    const previous = document.activeElement;
    const target = (initialFocusRef && initialFocusRef.current) || container.querySelector(FOCUSABLE) || container;
    target.focus({ preventScroll: true });

    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useOnClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    function onPointer(e) {
      if (ref.current && !ref.current.contains(e.target)) handler(e);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [ref, handler, active]);
}

// Locks page scroll while any dialog or drawer is open (counts nested ones).
let scrollLocks = 0;
export function useScrollLock(active) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    scrollLocks += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = '';
    };
  }, [active]);
}

export function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// Page-wide shortcuts. `keys` maps "mod+k", "/", "?" and two-key chords like
// "g d" to handlers. Plain keys are ignored while typing in a field or while a
// dialog is open; "mod+..." always works.
export function useHotkeys(keys, { enabled = true } = {}) {
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    if (!enabled) return undefined;
    let chord = null;
    let timer = null;
    function clearChord() {
      chord = null;
      clearTimeout(timer);
    }
    function onKeyDown(e) {
      const map = ref.current;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const handler = map[`mod+${key}`];
        if (handler) {
          e.preventDefault();
          handler(e);
        }
        return;
      }
      if (e.altKey || isTyping(e.target) || document.querySelector('[data-dialog-open]')) return;
      if (chord) {
        const handler = map[`${chord} ${key}`];
        clearChord();
        if (handler) {
          e.preventDefault();
          handler(e);
        }
        return;
      }
      if (map[key] && !Object.keys(map).some((k) => k.startsWith(`${key} `))) {
        e.preventDefault();
        map[key](e);
        return;
      }
      if (Object.keys(map).some((k) => k.startsWith(`${key} `))) {
        chord = key;
        timer = setTimeout(clearChord, 1200);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, [enabled]);
}

// "3 min ago", "Yesterday", "12 Mar 2026". `title` gives the exact time for tooltips.
export function relativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  const days = Math.round(seconds / 86400);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function exactTime(iso) {
  return iso ? new Date(iso).toLocaleString() : '';
}
