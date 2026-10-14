import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../roles';

// roles: allowed role names (users.role_name). The backend checks permissions on
// every request anyway; this only keeps people out of screens that aren't theirs.
export default function PrivateRoute({ roles, children }) {
  const { user, initialized } = useAuth();

  if (!initialized) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role_name)) return <Navigate to={dashboardPath(user)} replace />;

  return children;
}
