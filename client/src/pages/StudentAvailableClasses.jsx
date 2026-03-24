import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { classes as classesApi, attendance as attendanceApi } from '../api';
import './StudentPortal.css';

export function StudentAvailableClasses() {
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('Waiting...');
  const [gpsRefreshing, setGpsRefreshing] = useState(false);
  const [windowsByClass, setWindowsByClass] = useState({});

  const fetchGen = useRef(0);
  const loadClasses = useCallback(() => {
    const gen = ++fetchGen.current;
    setLoading(true);
    setError(null);
    classesApi
      .myBatch()
      .then((data) => {
        if (gen !== fetchGen.current) return;
        setList(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (gen !== fetchGen.current) return;
        setError(e.message || 'Failed to load classes');
      })
      .finally(() => {
        if (gen !== fetchGen.current) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Refetch when tab becomes visible or window gains focus — fixes stale "Marked" after date change
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') loadClasses();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', loadClasses);
    const id = setInterval(loadClasses, 45_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', loadClasses);
      clearInterval(id);
    };
  }, [loadClasses]);

  // Poll attendance window for enrolled classes so we know when marking is allowed
  useEffect(() => {
    if (!list || list.length === 0) return;
    let cancelled = false;

    const loadWindows = async () => {
      const enrolled = list.filter((c) => c.enrolled);
      for (const c of enrolled) {
        try {
          const w = await attendanceApi.getWindow(c.id);
          if (!cancelled) {
            setWindowsByClass((prev) => ({ ...prev, [c.id]: w }));
          }
        } catch {
          // ignore per-class errors
        }
      }
    };

    loadWindows();
    const interval = setInterval(loadWindows, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [list]);

  const refreshGps = () => {
    setGpsRefreshing(true);
    if (!navigator.geolocation) {
      setGpsStatus('Not supported');
      setGpsRefreshing(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsStatus('Ready');
        setGpsRefreshing(false);
      },
      () => {
        setGpsStatus('Denied / Unavailable');
        setGpsRefreshing(false);
      }
    );
  };

  useEffect(() => {
    refreshGps();
  }, []);

  const enrolledClasses = list.filter((c) => c.enrolled);

  const todayObj = new Date();
  const todayDate = todayObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <h1 className="student-portal__main-title">Available Classes</h1>
      <p className="student-portal__main-sub" style={{ marginBottom: 2 }}>
        Select a class to mark attendance
      </p>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
        {todayDate}
      </p>
      <div className={`student-portal__gps ${gpsRefreshing ? 'refreshing' : ''}`}>
        GPS: {gpsStatus}
        <button type="button" onClick={refreshGps} aria-label="Refresh GPS" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8v-6h-6M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16v6h6" />
          </svg>
        </button>
      </div>
      <div className="student-portal__card">
        {loading && <p className="student-portal__card--empty">Loading classes...</p>}
        {error && <p className="student-portal__error">Error: {error}</p>}
        {!loading && !error && list.length === 0 && (
          <p className="student-portal__card--empty">No classes available for your batch yet.</p>
        )}
        {!loading && !error && list.length > 0 && (
          <div>
            {list.map((c) => {
              const isEnrolled = !!c.enrolled;
              const hasMarked = !!c.attendance_marked;
              const win = windowsByClass[c.id];
              const winKey = win?.window;
              const canMark = winKey === 'present' || winKey === 'late';
              const buttonLabel = hasMarked
                ? 'Marked'
                : !isEnrolled
                  ? 'Enroll'
                  : winKey === 'not_started'
                    ? 'Not started yet'
                    : winKey === 'closed'
                      ? 'Attendance closed'
                      : 'Mark attendance';
              return (
                <div key={c.id} className="student-portal__class-item">
                  <div>
                    <div className="student-portal__class-name">{c.subject_name}</div>
                    <div className="student-portal__class-meta">
                      {fmtTime(c.start_time)} – {fmtTime(c.end_time)} · {c.batch} · {isEnrolled ? 'Enrolled' : 'Not enrolled'} ·{' '}
                      {hasMarked ? 'Attendance marked' : 'Not marked'}
                    </div>
                  </div>
                  {isEnrolled ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={hasMarked || !canMark}
                      onClick={() => navigate('/student/mark-attendance', { state: { classId: c.id } })}
                    >
                      {buttonLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={async () => {
                        try {
                          await classesApi.enroll(c.id);
                          const data = await classesApi.myBatch();
                          setList(Array.isArray(data) ? data : []);
                        } catch (e) {
                          setError(e.message || 'Failed to enroll in class');
                        }
                      }}
                    >
                      {buttonLabel}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
