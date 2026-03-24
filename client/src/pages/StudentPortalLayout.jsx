import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { studentAuth, notifications } from '../api';
import './StudentPortal.css';

const GraduationCap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export function StudentPortalLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalNotification, setPortalNotification] = useState(null);
  const pollRef = useRef(null);
  const lastDesktopNotificationIdRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('student_token');
    if (!token) {
      navigate('/student/login');
      return;
    }
    studentAuth
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('student_token');
        localStorage.removeItem('student_user');
        navigate('/student/login');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  // Notification banner above portal: poll unread notifications and show the next one
  useEffect(() => {
    if (!user || loading) return;
    let cancelled = false;

    const setup = async () => {
      // Inform backend about permission (if browser notifications are allowed)
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              await notifications.updatePermission(true);
            }
          } else if (Notification.permission === 'granted') {
            await notifications.updatePermission(true);
          }
        } else {
          await notifications.updatePermission(true);
        }
      } catch {
        // ignore permission sync errors
      }

      const poll = async () => {
        try {
          const list = await notifications.list();
          if (cancelled || !Array.isArray(list)) return;
          const next = list[0] || null;
          if (
            next &&
            next.id &&
            next.id !== lastDesktopNotificationIdRef.current &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            lastDesktopNotificationIdRef.current = next.id;
            try {
              const Notif = window.Notification;
              if (Notif) {
                void new Notif(next.title || 'Class reminder', {
                  body: next.body || '',
                  tag: String(next.id),
                });
              }
            } catch {
              // ignore if Notifications API throws
            }
          }
          setPortalNotification(next);
        } catch {
          // ignore polling errors (e.g. 401)
        }
      };

      await poll();
      pollRef.current = setInterval(poll, 30000);
    };

    setup();

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [user, loading]);

  const handleCloseNotification = async () => {
    const n = portalNotification;
    if (!n) {
      setPortalNotification(null);
      return;
    }
    setPortalNotification(null);
    try {
      await notifications.markRead(n.id);
    } catch {
      // even if marking read fails, keep it closed in this session
    }
  };

  if (loading) {
    return (
      <div className="student-portal">
        <div className="student-portal__main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading...
        </div>
      </div>
    );
  }

  const initial = (user?.name || user?.email || 'P').charAt(0).toUpperCase();
  const regNo = user?.student_id || user?.id || '—';

  return (
    <div className="student-portal">
      <aside className="student-portal__sidebar">
        <div className="student-portal__header">
          <span className="student-portal__header-icon">
            <GraduationCap />
          </span>
          Student Portal
        </div>
        <nav className="student-portal__nav">
          <NavLink to="/student/portal" end className={({ isActive }) => `student-portal__nav-link ${isActive ? 'active' : ''}`}>
            <CalendarIcon />
            Available Classes
          </NavLink>
          <NavLink to="/student/portal/session" className={({ isActive }) => `student-portal__nav-link ${isActive ? 'active' : ''}`}>
            <ClockIcon />
            Active Session
          </NavLink>
          <NavLink to="/student/portal/history" className={({ isActive }) => `student-portal__nav-link ${isActive ? 'active' : ''}`}>
            <HistoryIcon />
            My History
          </NavLink>
          <NavLink to="/student/portal/profile" className={({ isActive }) => `student-portal__nav-link ${isActive ? 'active' : ''}`}>
            <UserIcon />
            Profile
          </NavLink>
        </nav>
        <div className="student-portal__user">
          <div className="student-portal__avatar" title="Profile photo">
            {user?.profile_photo ? (
              <img src={`data:image/jpeg;base64,${user.profile_photo}`} alt="" />
            ) : (
              initial
            )}
          </div>
          <div className="student-portal__user-info">
            <div className="student-portal__user-name">{user?.name || 'Student'}</div>
            <div className="student-portal__user-reg">{regNo}</div>
          </div>
        </div>
      </aside>
      <main className="student-portal__main">
        {portalNotification && (
          <div className="student-portal__notification">
            <div className="student-portal__notification-title">
              {portalNotification.title || 'Class reminder'}
            </div>
            {portalNotification.body && (
              <div className="student-portal__notification-body">
                {portalNotification.body}
              </div>
            )}
            <button
              type="button"
              className="student-portal__notification-close"
              aria-label="Dismiss notification"
              onClick={handleCloseNotification}
            >
              ×
            </button>
          </div>
        )}
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
