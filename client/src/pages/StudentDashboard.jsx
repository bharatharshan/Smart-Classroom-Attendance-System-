import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { studentAuth, classes, notifications } from '../api';
import './Dashboard.css';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const shownNotificationIds = useRef(new Set());
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('student_token');
    if (!token) {
      navigate('/student/login');
      return;
    }
    (async () => {
      try {
        const me = await studentAuth.me();
        setUser(me);
        try {
          const batchData = await classes.myBatch();
          setBatch(batchData);
        } catch {
          setBatch(null);
        }
      } catch {
        localStorage.removeItem('student_token');
        localStorage.removeItem('student_user');
        navigate('/student/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  // Request browser notification permission and store on backend; then poll for notifications
  useEffect(() => {
    if (!user || loading) return;

    const requestPermissionAndPoll = async () => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          try {
            await notifications.updatePermission(true);
          } catch {
            // ignore
          }
        }
      } else if (Notification.permission === 'granted') {
        try {
          await notifications.updatePermission(true);
        } catch {
          // ignore
        }
      }

      const poll = async () => {
        try {
          const list = await notifications.list();
          if (!Array.isArray(list)) return;
          for (const n of list) {
            if (shownNotificationIds.current.has(n.id)) continue;
            shownNotificationIds.current.add(n.id);
            try {
              const notif = new Notification(n.title || 'Class reminder', {
                body: n.body || '',
                icon: '/favicon.ico',
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch {
              // permission revoked or not supported
            }
          }
        } catch {
          // e.g. 401 when logged out
        }
      };

      poll();
      pollIntervalRef.current = setInterval(poll, 45000);
    };

    requestPermissionAndPoll();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user, loading]);

  const handleLogout = () => {
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
    navigate('/student/login');
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__brand">
          <span className="dashboard__logo">P+</span>
          <span>PRESENCE+</span>
        </div>
        <div className="dashboard__user">
          <span>{user?.name || user?.email}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main className="dashboard__main">
        <h1 className="dashboard__greeting">Welcome, {user?.name || 'Student'}!</h1>
        <p className="dashboard__sub">Smart Attendance – Student Dashboard</p>
        <div className="dashboard__cards">
          <Link to="/student/mark-attendance" className="dashboard__card dashboard__card--primary">
            <span className="dashboard__card-icon">✓</span>
            <h3>Mark Attendance</h3>
            <p>Submit your attendance for today</p>
          </Link>
          {batch && (
            <div className="dashboard__card">
              <span className="dashboard__card-icon">📚</span>
              <h3>My Batch</h3>
              <p>{batch.name || batch.class_name || 'Your enrolled class'}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
