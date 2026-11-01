import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../roles';

// Shows a page only to the listed roles; everyone else goes to their dashboard.
export default function RoleOnly({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role_name)) return <Navigate to={dashboardPath(user)} replace />;
  return children;
}
