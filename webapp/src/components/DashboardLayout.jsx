import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Database, ClipboardCheck, Map, Activity, FileText, Users, ShieldCheck, UserCircle, PlusCircle, List,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES, dashboardPath } from '../roles';

// Staff area: a sidebar with one item per feature, and the chosen page next to it.
// The menu depends on the role; the backend still checks every request.
function menuFor(user) {
  const home = { to: dashboardPath(user), label: 'Dashboard', icon: LayoutDashboard, end: true };
  const account = { to: '/account', label: 'My Account', icon: UserCircle };

  if (user.role_name === ROLES.BOTANIST) {
    return [
      home,
      { to: '/register', label: 'Register Plant', icon: PlusCircle },
      { to: '/records', label: 'My Records', icon: List },
      { to: '/requests', label: 'My Requests', icon: ClipboardCheck },
      account,
    ];
  }

  const staff = [
    home,
    { to: '/records', label: 'Species Database', icon: Database },
    { to: '/requests', label: 'Change Requests', icon: ClipboardCheck },
    { to: '/map', label: 'Distribution Map', icon: Map },
    { to: '/iot', label: 'IoT Monitoring', icon: Activity },
    { to: '/reports', label: 'Reports', icon: FileText },
  ];
  if (user.role_name === ROLES.ADMIN) {
    staff.push(
      { to: '/users', label: 'Users', icon: Users },
      { to: '/audit', label: 'Audit Log', icon: ShieldCheck },
    );
  }
  return [...staff, account];
}

export default function DashboardLayout() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="app-shell container">
      <aside className="sidebar">
        <nav>
          {menuFor(user).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
