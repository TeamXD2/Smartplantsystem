import { Link, useNavigate } from 'react-router-dom';
import { Leaf, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dashboardPath } from '../roles';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="container">
        <Link className="navbar-brand" to="/">
          <Leaf size={20} /> Niah Biodiversity
        </Link>
        <div className="navbar-links">
          <Link to="/species">Species Catalog</Link>
          {user ? (
            <>
              <Link to={dashboardPath(user)}>My Dashboard</Link>
              <span className="navbar-user">
                <User size={14} /> {user.full_name} &middot; {user.role_name}
                {user.botanist_type ? ` (${user.botanist_type})` : ''}
              </span>
              <button
                className="btn btn-outline-light btn-sm"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <Link className="btn btn-primary btn-sm" to="/login">Staff Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
