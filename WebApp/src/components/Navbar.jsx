import { Link, useNavigate } from 'react-router-dom';
import { Leaf, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DASHBOARD_PATH = {
  botanist: '/botanist',
  conservation_officer: '/officer',
  admin: '/admin',
};

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
              <Link to={DASHBOARD_PATH[user.role]}>My Dashboard</Link>
              <span className="navbar-user">
                <User size={14} /> {user.name} &middot; {user.role.replace('_', ' ')}
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
            <>
              <Link to="/login">Staff Login</Link>
              <Link className="btn btn-primary btn-sm" to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
