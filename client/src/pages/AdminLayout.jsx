import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './AdminPortal.css';

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 004 19.5v-15A2.5 2.5 0 016.5 2z" />
    <path d="M8 7h8M8 11h8" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M8 10h.01M8 14h.01M16 14h.01" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export function AdminLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    const loggedIn = localStorage.getItem('admin_logged_in') === 'true';
    if (!loggedIn) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    navigate('/admin/login');
  };

  return (
    <div className="admin-portal">
      <aside className="admin-portal__sidebar">
        <div className="admin-portal__header">
          <span className="admin-portal__header-icon">
            <ShieldIcon />
          </span>
          Admin Portal
        </div>
        <nav className="admin-portal__nav">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `admin-portal__nav-link ${isActive ? 'active' : ''}`}
          >
            <HomeIcon />
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/periods"
            className={({ isActive }) => `admin-portal__nav-link ${isActive ? 'active' : ''}`}
          >
            <ClockIcon />
            Period Management
          </NavLink>
          <NavLink
            to="/admin/subjects"
            className={({ isActive }) => `admin-portal__nav-link ${isActive ? 'active' : ''}`}
          >
            <BookIcon />
            Subject Management
          </NavLink>
          <NavLink
            to="/admin/faculty"
            className={({ isActive }) => `admin-portal__nav-link ${isActive ? 'active' : ''}`}
          >
            <UsersIcon />
            Faculty Management
          </NavLink>
          <NavLink
            to="/admin/classrooms"
            className={({ isActive }) => `admin-portal__nav-link ${isActive ? 'active' : ''}`}
          >
            <BuildingIcon />
            Classroom Management
          </NavLink>
        </nav>
        <div className="admin-portal__user">
          <div className="admin-portal__avatar">A</div>
          <div className="admin-portal__user-name">Admin</div>
        </div>
        <nav className="admin-portal__nav">
          <button
            type="button"
            className="admin-portal__nav-link"
            onClick={handleLogout}
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogoutIcon />
            Logout
          </button>
        </nav>
      </aside>
      <main className="admin-portal__main">
        <Outlet />
      </main>
    </div>
  );
}
