import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { attendance as attendanceApi, studentAuth } from '../api';
import './StudentPortal.css';

export function StudentHistory() {
  const { user } = useOutletContext() || {};
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    attendanceApi
      .getMyHistory(user.id)
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    const day = dt.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${day}, ${time}`;
  };

  return (
    <>
      <h1 className="student-portal__main-title">My History</h1>
      <p className="student-portal__main-sub">Your attendance records</p>
      <div className="student-portal__card">
        {loading && <p className="student-portal__card--empty">Loading...</p>}
        {error && <p className="student-portal__error">{error}</p>}
        {!loading && !error && list.length === 0 && (
          <p className="student-portal__card--empty">No attendance records yet.</p>
        )}
        {!loading && !error && list.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {list.map((a) => {
              const statusColor =
                a.status === 'PRESENT' ? '#16a34a' :
                a.status === 'LATE' ? '#f59e0b' :
                '#ef4444';
              return (
                <div key={a.id} className="student-portal__class-item">
                  <div>
                    <div className="student-portal__class-name">
                      {a.subject_name || 'Class'}{' '}
                      <span style={{ color: statusColor, fontWeight: 600, fontSize: '0.85rem' }}>
                        {a.status}
                      </span>
                    </div>
                    <div className="student-portal__class-meta">
                      {formatDate(a.entry_time || a.capture_time)}
                      {a.face_verified && ' · Face verified'}
                      {a.location_verified && ' · Location verified'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
