import { Link, useNavigate } from 'react-router-dom';
import { Keyboard, LogOut, UserCircle, Globe } from 'lucide-react';
import Popover from '../ui/Popover';
import { useAuth } from '../../context/AuthContext';

export function initialsOf(user) {
  return (user.full_name || user.email || '?').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function UserMenu({ onShowShortcuts }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = `${user.role_name}${user.botanist_type ? ` (${user.botanist_type})` : ''}`;

  return (
    <Popover
      role="menu"
      label="Account menu"
      panelClassName="menu-panel user-panel"
      renderTrigger={({ toggle, ref, props }) => (
        <button type="button" ref={ref} className="user-trigger" onClick={toggle} aria-label={`Account menu for ${user.full_name}`} {...props}>
          <span className="avatar avatar-sm" aria-hidden="true">{initialsOf(user)}</span>
          <span className="user-trigger-text">
            <span className="user-trigger-name">{user.full_name}</span>
            <span className="user-trigger-role">{role}</span>
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="user-panel-head">
            <div className="user-name">{user.full_name}</div>
            <div className="muted">{user.email}</div>
            <span className="tag tag-approved">{role}</span>
          </div>
          <Link role="menuitem" className="menu-item" to="/account" onClick={close}><UserCircle size={16} /> My account</Link>
          <Link role="menuitem" className="menu-item" to="/" onClick={close}><Globe size={16} /> Public site</Link>
          <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); onShowShortcuts(); }}><Keyboard size={16} /> Keyboard shortcuts</button>
          <button type="button" role="menuitem" className="menu-item danger" onClick={() => { close(); logout(); navigate('/'); }}><LogOut size={16} /> Log out</button>
        </>
      )}
    </Popover>
  );
}
