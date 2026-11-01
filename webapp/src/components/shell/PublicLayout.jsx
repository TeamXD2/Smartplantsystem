import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Leaf, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardPath } from '../../roles';

// The public site: top bar, the page, and a footer.
export default function PublicLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    if (mainRef.current) mainRef.current.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="public">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); if (mainRef.current) mainRef.current.focus(); }}>Skip to content</a>
      <header className="navbar">
        <div className="container navbar-inner">
          <Link className="brand brand-light" to="/">
            <span className="brand-mark"><Leaf size={20} /></span>
            <span className="brand-name">RimbaTag</span>
          </Link>
          <nav className="navbar-links" aria-label="Main">
            <NavLink to="/species" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Species catalog</NavLink>
            {user ? (
              <>
                <NavLink to={dashboardPath(user)} className="nav-link">Dashboard</NavLink>
                <Link to="/account" className="nav-user" title="My account"><User size={15} aria-hidden="true" /> <span>{user.full_name}</span></Link>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { logout(); navigate('/'); }}>Log out</button>
              </>
            ) : (
              <Link className="btn btn-primary btn-sm" to="/login">Staff login</Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="public-main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <div className="footer-brand"><Leaf size={16} aria-hidden="true" /> RimbaTag</div>
            <p>Smart Ground-Truthing &amp; Digital Biodiversity System for Niah National Park, maintained by Sarawak Forestry Corporation with NeuonAI.</p>
          </div>
          <nav aria-label="Footer">
            <Link to="/species">Species catalog</Link>
            {user ? <Link to={dashboardPath(user)}>Dashboard</Link> : <Link to="/login">Staff login</Link>}
          </nav>
        </div>
      </footer>
    </div>
  );
}
