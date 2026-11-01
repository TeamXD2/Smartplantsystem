import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Leaf, Menu, PanelLeftClose, PanelLeftOpen, Search, X, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationsProvider, useNotifications } from '../context/NotificationsContext';
import { menuFor, currentItem } from '../nav';
import { useFocusTrap, useHotkeys, useLocalStorage, useScrollLock } from '../hooks';
import Breadcrumbs from './ui/Breadcrumbs';
import NotificationBell from './shell/NotificationBell';
import UserMenu from './shell/UserMenu';
import CommandPalette from './shell/CommandPalette';
import ShortcutsDialog, { MOD } from './shell/ShortcutsDialog';

// The staff area: a dark forest rail (a drawer on phones), a top bar with
// breadcrumbs, search, the notification bell and the account menu, and the page.
function Rail({ items, open, collapsed, onToggleCollapse, onClose }) {
  const ref = useRef(null);
  const n = useNotifications();
  useScrollLock(open);
  useFocusTrap(ref, open);

  return (
    <>
      <aside
        ref={ref}
        id="rail"
        className={`rail ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}
        aria-label="Staff navigation"
        onKeyDown={(e) => { if (e.key === 'Escape' && open) onClose(); }}
      >
        <div className="rail-head">
          <Link className="brand" to="/" title="RimbaTag public site">
            <span className="brand-mark"><Leaf size={20} /></span>
            <span className="brand-name">RimbaTag</span>
          </Link>
          <button type="button" className="icon-btn rail-close" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        <nav className="rail-nav">
          {items.map(({ to, label, icon: Icon, end, shortcut, badge }) => {
            const count = badge ? n.badge(badge) : 0;
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
                title={collapsed ? label : `${label} (g ${shortcut})`}
                onClick={onClose}
              >
                <Icon size={19} aria-hidden="true" />
                <span className="rail-label">{label}</span>
                {count > 0 && (
                  <span className="rail-badge" aria-label={`${count} ${badge === 'alerts' ? 'open alerts' : badge === 'pending' ? 'waiting' : 'new decisions'}`}>{count > 99 ? '99+' : count}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="rail-foot">
          <Link to="/" className="rail-link rail-quiet" title="Public site"><Globe size={19} aria-hidden="true" /><span className="rail-label">Public site</span></Link>
          <button type="button" className="rail-link rail-quiet rail-collapse" onClick={onToggleCollapse} aria-pressed={collapsed} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
            {collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
            <span className="rail-label">{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </aside>
      {open && <div className="rail-scrim" onClick={onClose} aria-hidden="true" />}
    </>
  );
}

function Shell() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const firstRender = useRef(true);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage('rt_rail_collapsed', false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);

  const items = menuFor(user);
  const here = currentItem(user, location.pathname);
  const home = items[0];

  // New page: close the drawer, scroll up, and hand focus to the page so keyboard
  // and screen-reader users start at the top of the new content.
  useEffect(() => {
    setDrawer(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    if (mainRef.current) mainRef.current.focus({ preventScroll: true });
  }, [location.pathname]);

  const openPalette = useCallback(() => setPalette(true), []);
  const showHelp = useCallback(() => setHelp(true), []);

  const keys = {
    'mod+k': () => setPalette((p) => !p),
    '/': openPalette,
    '?': showHelp,
  };
  items.forEach((item) => { keys[`g ${item.shortcut}`] = () => navigate(item.to); });
  useHotkeys(keys);

  const crumbs = here && here.to !== home.to
    ? [{ label: 'Dashboard', to: home.to }, { label: here.label }]
    : [{ label: 'Dashboard' }];

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); if (mainRef.current) mainRef.current.focus(); }}>Skip to content</a>
      <Rail items={items} open={drawer} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} onClose={() => setDrawer(false)} />

      <div className="shell-body">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu" aria-controls="rail" aria-expanded={drawer}>
            <Menu size={22} />
          </button>
          <div className="topbar-crumbs">
            <Breadcrumbs items={crumbs} />
            <span className="topbar-title" aria-hidden="true">{here ? here.label : 'Dashboard'}</span>
          </div>
          <div className="topbar-end">
            <button type="button" className="search-trigger" onClick={openPalette} aria-label="Search pages, actions and species" aria-keyshortcuts="Control+K Meta+K /">
              <Search size={16} aria-hidden="true" />
              <span className="search-trigger-text">Search</span>
              <kbd>{MOD} K</kbd>
            </button>
            <NotificationBell />
            <UserMenu onShowShortcuts={showHelp} />
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="shell-main">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onShowShortcuts={showHelp} />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

export default function DashboardLayout() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <NotificationsProvider>
      <Shell />
    </NotificationsProvider>
  );
}
