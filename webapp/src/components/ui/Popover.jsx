import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useOnClickOutside } from '../../hooks';

// A small floating panel anchored to a button (menus, the notification list).
// It is positioned with `fixed` so table and scroll containers never clip it, and
// it flips above the button when there is no room below.
//   renderTrigger({ open, toggle, ref, props })  -> the button
//   children: node or ({ close }) => node
export default function Popover({ renderTrigger, children, align = 'end', panelClassName = '', onOpenChange, role = 'dialog', label }) {
  const [open, setOpenState] = useState(false);
  const [pos, setPos] = useState(null);
  const wrap = useRef(null);
  const trigger = useRef(null);
  const panel = useRef(null);

  const setOpen = useCallback((next) => {
    setOpenState((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      if (value !== current && onOpenChange) onOpenChange(value);
      return value;
    });
  }, [onOpenChange]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useOnClickOutside(wrap, close, open);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) {
      setPos(null);
      return undefined;
    }
    function place() {
      const t = trigger.current.getBoundingClientRect();
      const p = panel.current.getBoundingClientRect();
      const gap = 8;
      const below = t.bottom + gap + p.height <= window.innerHeight - 8;
      const top = below ? t.bottom + gap : Math.max(8, t.top - gap - p.height);
      let left = align === 'end' ? t.right - p.width : t.left;
      left = Math.min(Math.max(8, left), window.innerWidth - p.width - 8);
      setPos({ top, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, align, close]);

  // Menus: focus the first item on open; arrow keys, Home and End move between items.
  useEffect(() => {
    if (open && role === 'menu' && pos && panel.current) {
      const first = panel.current.querySelector('[role="menuitem"]:not([disabled])');
      if (first) first.focus();
    }
  }, [open, role, pos !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  function onPanelKeyDown(e) {
    if (role !== 'menu') return;
    const items = [...panel.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = items[(index + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[(index - 1 + items.length) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  return (
    <div
      className="popover-wrap"
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
          if (trigger.current) trigger.current.focus();
        }
      }}
    >
      {renderTrigger({
        open,
        toggle: () => setOpen((o) => !o),
        ref: trigger,
        props: { 'aria-haspopup': role === 'menu' ? 'menu' : 'dialog', 'aria-expanded': open },
      })}
      {open && (
        <div
          ref={panel}
          role={role}
          aria-label={label}
          className={`popover-panel ${panelClassName}`}
          onKeyDown={onPanelKeyDown}
          style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}
