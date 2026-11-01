import {
  LayoutDashboard, Database, ClipboardCheck, Map, Activity, FileText, Users, ShieldCheck, UserCircle, PlusCircle, List,
} from 'lucide-react';
import { ROLES, dashboardPath } from './roles';

// The staff area's menu, per role. One list feeds the sidebar, the breadcrumbs,
// the search palette and the keyboard shortcuts, so they can never disagree.
//   shortcut: press "g" then this key.   badge: which live count to show.
export function menuFor(user) {
  const home = { to: dashboardPath(user), label: 'Dashboard', icon: LayoutDashboard, end: true, shortcut: 'd', keywords: 'home overview summary' };
  const account = { to: '/account', label: 'My account', icon: UserCircle, shortcut: 'c', keywords: 'password profile' };

  if (user.role_name === ROLES.BOTANIST) {
    return [
      home,
      { to: '/register', label: 'Register plant', icon: PlusCircle, shortcut: 'n', keywords: 'new add create plant' },
      { to: '/records', label: 'My records', icon: List, shortcut: 'r', keywords: 'plants species' },
      { to: '/requests', label: 'My requests', icon: ClipboardCheck, shortcut: 'q', badge: 'decided', keywords: 'edit delete requests decisions' },
      account,
    ];
  }

  const staff = [
    home,
    { to: '/records', label: 'Species database', icon: Database, shortcut: 'r', keywords: 'plants records publish' },
    { to: '/requests', label: 'Change requests', icon: ClipboardCheck, shortcut: 'q', badge: 'pending', keywords: 'approve reject review' },
    { to: '/map', label: 'Distribution map', icon: Map, shortcut: 'm', keywords: 'gps locations' },
    { to: '/iot', label: 'IoT monitoring', icon: Activity, shortcut: 'i', badge: 'alerts', keywords: 'sensors alerts esp32 temperature' },
    { to: '/reports', label: 'Reports', icon: FileText, shortcut: 'p', keywords: 'export csv statistics' },
  ];
  if (user.role_name === ROLES.ADMIN) {
    staff.push(
      { to: '/users', label: 'Users', icon: Users, shortcut: 'u', keywords: 'accounts roles passwords' },
      { to: '/audit', label: 'Audit log', icon: ShieldCheck, shortcut: 'a', keywords: 'history activity security' },
    );
  }
  return [...staff, account];
}

export function currentItem(user, pathname) {
  return menuFor(user).find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to))) || null;
}
