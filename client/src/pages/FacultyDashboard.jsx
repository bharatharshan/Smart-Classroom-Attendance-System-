import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { facultyAuth, timetable, facultyClasses, facultyAnalytics, admin } from '../api';
import { TimetableForm } from '../components/TimetableForm';
import FacultyDashboardCharts from '../components/FacultyDashboardCharts';
import './FacultyDashboard.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** View Attendance: classes with no batch bucket */
const VIEW_BATCH_NONE = '__NO_BATCH__';

const NavIconHome = () => (
  <svg className="faculty-dashboard__nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const NavIconCalendar = () => (
  <svg className="faculty-dashboard__nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const NavIconEdit = () => (
  <svg className="faculty-dashboard__nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const NavIconClipboard = () => (
  <svg className="faculty-dashboard__nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
const NavIconBriefcase = () => (
  <svg className="faculty-dashboard__nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);
const NavIconLogout = () => (
  <svg className="faculty-dashboard__nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
const IconBook = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const IconUsers = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const IconCheck = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/** Coarse present vs absent from API status string */
function presentAbsentLabel(status) {
  if (!status) return '—';
  const u = String(status).toUpperCase();
  if (u === 'ABSENT') return 'Absent';
  if (u === 'PRESENT' || u === 'LATE' || u === 'IN_PROGRESS') return 'Present';
  return '—';
}

function lastSessionBadgeModifier(status) {
  if (!status) return 'none';
  const u = String(status).toUpperCase();
  if (u === 'PRESENT') return 'on-time';
  if (u === 'LATE') return 'late';
  if (u === 'ABSENT') return 'absent';
  if (u === 'IN_PROGRESS') return 'in-progress';
  return 'none';
}

/** Timetable sync stores `class_code` as `{faculty8}_{Day3}_{period_id}` */
function parseTimetableClassCode(classCode) {
  if (!classCode || typeof classCode !== 'string') return { dayAbbrev: null, periodId: null };
  const parts = classCode.split('_');
  if (parts.length < 3) return { dayAbbrev: null, periodId: null };
  return { dayAbbrev: parts[1], periodId: parts.slice(2).join('_') };
}

const DAY_ABBREV_LABEL = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

function formatPeriodTiming(startTime, endTime) {
  if (!startTime || !endTime) return '—';
  const s = new Date(startTime);
  const e = new Date(endTime);
  const opts = { hour: '2-digit', minute: '2-digit' };
  return `${s.toLocaleTimeString(undefined, opts)} – ${e.toLocaleTimeString(undefined, opts)}`;
}

function formatSessionDate(isoDateStr) {
  if (!isoDateStr) return '—';
  const s = String(isoDateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split('-').map(Number);
    const d = new Date(y, mo - 1, da);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return isoDateStr;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function periodDisplayLabel(periodId, periodsList) {
  if (!periodId) return '—';
  const p = Array.isArray(periodsList) ? periodsList.find((x) => x.period_id === periodId) : null;
  if (p?.period_name && p.period_type !== 'break') {
    return `${periodId} — ${p.period_name}`;
  }
  return periodId;
}

/** View Attendance: disambiguate multiple slots (same batch + subject) */
function formatViewSlotLabel(c, periodsList) {
  if (!c) return '';
  const { dayAbbrev, periodId } = parseTimetableClassCode(c.class_code);
  const dayLabel = dayAbbrev ? DAY_ABBREV_LABEL[dayAbbrev] || dayAbbrev : null;
  const pLine = periodDisplayLabel(periodId, periodsList);
  const parts = [dayLabel, pLine].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return c.class_code || String(c.id).slice(0, 8);
}

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [timetableData, setTimetableData] = useState(null);
  const [stats, setStats] = useState({ totalClasses: 0, totalStudents: 0, todayClasses: 0 });
  const [classList, setClassList] = useState([]);
  const [recentClasses, setRecentClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  /** My Classes panel: enrolled students + last session status */
  const [classDetail, setClassDetail] = useState(null);
  const [lastSessionLoading, setLastSessionLoading] = useState(false);
  const [periods, setPeriods] = useState([]);
  /** View Attendance: filters + API summary */
  const [viewClassList, setViewClassList] = useState([]);
  /** Student batch / class group e.g. 6MCA-B, 6MCAA (stored batch string) */
  const [viewBatch, setViewBatch] = useState('');
  const [viewSubject, setViewSubject] = useState('');
  const [viewClassId, setViewClassId] = useState('');
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceSummaryLoading, setAttendanceSummaryLoading] = useState(false);
  const [attendanceSummaryError, setAttendanceSummaryError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('faculty_token');
    if (!token) {
      navigate('/faculty/login');
      return;
    }
    Promise.all([
      facultyAuth.me(),
      admin.periods.list().catch(() => []),
    ])
      .then(([userData, periodData]) => {
        setUser(userData);
        const all = Array.isArray(periodData) ? periodData : [];
        all.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setPeriods(all);
      })
      .catch(() => {
        localStorage.removeItem('faculty_token');
        localStorage.removeItem('faculty_user');
        navigate('/faculty/login');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const loadTimetable = () => {
    timetable
      .getActive()
      .then((t) => setTimetableData(t))
      .catch(() => setTimetableData(null));
  };

  const loadStats = () => {
    facultyClasses
      .stats()
      .then((data) => {
        setStats({
          totalClasses: data.total_classes ?? 0,
          totalStudents: data.total_students ?? 0,
          todayClasses: data.today_classes ?? 0,
        });
      })
      .catch(() => {});
  };

  const loadAnalytics = () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    facultyAnalytics
      .getDashboard({ days: 30, daily_days: 14 })
      .then((data) => {
        setAnalytics(data);
      })
      .catch((e) => {
        setAnalytics(null);
        setAnalyticsError(e.message || 'Could not load analytics');
      })
      .finally(() => setAnalyticsLoading(false));
  };

  const loadFacultyClasses = () => {
    facultyClasses
      .list()
      .then(setClassList)
      .catch(() => setClassList([]));
  };

  const loadRecentClasses = () => {
    facultyClasses
      .recent(5)
      .then((list) => setRecentClasses(Array.isArray(list) ? list : []))
      .catch(() => setRecentClasses([]));
  };

  const loadViewAttendanceClasses = () => {
    facultyClasses
      .list()
      .then((list) => {
        setViewClassList(Array.isArray(list) ? list : []);
      })
      .catch(() => setViewClassList([]));
  };

  const loadAttendanceSummary = useCallback((classId) => {
    if (!classId) {
      setAttendanceSummary(null);
      setAttendanceSummaryLoading(false);
      return;
    }
    setAttendanceSummaryLoading(true);
    setAttendanceSummaryError('');
    facultyClasses
      .getAttendanceSummary(classId)
      .then((data) => setAttendanceSummary(data))
      .catch((e) => {
        setAttendanceSummary(null);
        setAttendanceSummaryError(e.message || 'Failed to load attendance');
      })
      .finally(() => setAttendanceSummaryLoading(false));
  }, []);

  const loadClassStudents = (classId) => {
    setSelectedClassId(classId);
    setLastSessionLoading(true);
    setClassDetail(null);
    facultyClasses
      .getStudentsLastSession(classId)
      .then((data) => {
        setClassDetail({
          subject_name: data.subject_name,
          class_code: data.class_code,
          batch: data.batch,
          students: data.students || [],
        });
      })
      .catch(() => {
        setClassDetail(null);
      })
      .finally(() => setLastSessionLoading(false));
  };

  const closeClassStudentsModal = useCallback(() => {
    setSelectedClassId(null);
    setClassDetail(null);
    setLastSessionLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedClassId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeClassStudentsModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedClassId, closeClassStudentsModal]);

  useEffect(() => {
    if (!user) return;
    if (currentPage === 'dashboard' || currentPage === 'view-timetable' || currentPage === 'edit-timetable') {
      loadTimetable();
    }
    if (currentPage === 'dashboard') {
      loadStats();
      loadAnalytics();
    }
    if (currentPage === 'view-attendance') {
      loadViewAttendanceClasses();
      setViewBatch('');
      setViewSubject('');
      setViewClassId('');
      setAttendanceSummary(null);
      setAttendanceSummaryError('');
    }
    if (currentPage === 'my-classes') {
      loadFacultyClasses();
      loadRecentClasses();
      setSelectedClassId(null);
      setClassDetail(null);
      setLastSessionLoading(false);
    } else {
      setSelectedClassId(null);
      setClassDetail(null);
      setLastSessionLoading(false);
    }
  }, [user, currentPage]);

  /** Batch values for dropdown 1 (no subject text) */
  const viewBatchOptions = useMemo(() => {
    const map = new Map();
    viewClassList.forEach((c) => {
      const raw = c.batch && String(c.batch).trim();
      const value = raw || VIEW_BATCH_NONE;
      const label = raw || '(No batch assigned)';
      map.set(value, label);
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }),
    );
  }, [viewClassList]);

  const classesInSelectedBatch = useMemo(() => {
    if (!viewBatch) return [];
    if (viewBatch === VIEW_BATCH_NONE) {
      return viewClassList.filter((c) => !String(c.batch || '').trim());
    }
    return viewClassList.filter((c) => String(c.batch || '').trim() === viewBatch);
  }, [viewClassList, viewBatch]);

  /** Subject titles for dropdown 2 — only for selected batch */
  const viewSubjectOptionsForBatch = useMemo(() => {
    const set = new Set();
    classesInSelectedBatch.forEach((c) => {
      set.add(c.subject_name || c.subject_code || 'General');
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [classesInSelectedBatch]);

  /** Timetable rows matching batch + subject (may be >1 slot) */
  const viewClassMatches = useMemo(() => {
    if (!viewBatch || !viewSubject) return [];
    return classesInSelectedBatch.filter(
      (c) => (c.subject_name || c.subject_code || 'General') === viewSubject,
    );
  }, [classesInSelectedBatch, viewBatch, viewSubject]);

  useEffect(() => {
    if (currentPage !== 'view-attendance') return;
    if (viewClassMatches.length === 1) {
      setViewClassId(viewClassMatches[0].id);
    } else if (viewClassMatches.length > 1) {
      setViewClassId((prev) =>
        prev && viewClassMatches.some((c) => c.id === prev) ? prev : '',
      );
    } else {
      setViewClassId('');
    }
  }, [currentPage, viewClassMatches]);

  useEffect(() => {
    if (currentPage !== 'view-attendance') return;
    loadAttendanceSummary(viewClassId);
  }, [currentPage, viewClassId, loadAttendanceSummary]);

  const handleLogout = () => {
    localStorage.removeItem('faculty_token');
    localStorage.removeItem('faculty_user');
    navigate('/faculty/login');
  };

  if (loading) {
    return (
      <div className="faculty-dashboard">
        <div className="faculty-dashboard__loading" style={{ padding: 60 }}>Loading...</div>
      </div>
    );
  }

  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: <NavIconHome /> },
    { id: 'view-timetable', label: 'View Timetable', icon: <NavIconCalendar /> },
    { id: 'edit-timetable', label: 'Edit Timetable', icon: <NavIconEdit /> },
    { id: 'view-attendance', label: 'View Attendance', icon: <NavIconClipboard /> },
    { id: 'my-classes', label: 'My Classes', icon: <NavIconBriefcase /> },
  ];

  return (
    <div className="faculty-dashboard">
      <aside className="faculty-dashboard__sidebar">
        <div className="faculty-dashboard__faculty-info">
          <div className="faculty-dashboard__avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'F'}
          </div>
          <div className="faculty-dashboard__name">{user?.name || 'Loading...'}</div>
          <div className="faculty-dashboard__email">{user?.email || 'Loading...'}</div>
        </div>
        <nav>
          <ul className="faculty-dashboard__nav">
            {nav.map((item) => (
              <li key={item.id} className="faculty-dashboard__nav-item">
                <button
                  type="button"
                  className={`faculty-dashboard__nav-link ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => setCurrentPage(item.id)}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
            <li className="faculty-dashboard__nav-item">
              <button type="button" className="faculty-dashboard__nav-link" onClick={handleLogout}>
                <NavIconLogout />
                Logout
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="faculty-dashboard__main">
        {/* Dashboard */}
        <div className={`faculty-dashboard__page ${currentPage === 'dashboard' ? 'active' : ''}`}>
          <div className="faculty-dashboard__content-header">
            <h1 className="faculty-dashboard__page-title">Faculty Dashboard</h1>
          </div>
          <div className="faculty-dashboard__stats">
            <div className="faculty-dashboard__stat-card">
              <div className="faculty-dashboard__stat-icon"><IconBook /></div>
              <div className="faculty-dashboard__stat-info">
                <h3>{stats.totalClasses}</h3>
                <p>Total Classes</p>
              </div>
            </div>
            <div className="faculty-dashboard__stat-card">
              <div className="faculty-dashboard__stat-icon"><IconUsers /></div>
              <div className="faculty-dashboard__stat-info">
                <h3>{stats.totalStudents}</h3>
                <p>Total Students</p>
              </div>
            </div>
            <div className="faculty-dashboard__stat-card">
              <div className="faculty-dashboard__stat-icon"><IconCheck /></div>
              <div className="faculty-dashboard__stat-info">
                <h3>{stats.todayClasses}</h3>
                <p>Today's Classes</p>
              </div>
            </div>
          </div>
          <FacultyDashboardCharts
            data={analytics}
            loading={analyticsLoading}
            error={analyticsError}
          />
        </div>

        {/* View Timetable */}
        <div className={`faculty-dashboard__page ${currentPage === 'view-timetable' ? 'active' : ''}`}>
          <div className="faculty-dashboard__content-header">
            <h1 className="faculty-dashboard__page-title">View Timetable</h1>
          </div>
          <div className="faculty-dashboard__timetable-wrap">
            <div className="faculty-dashboard__timetable-header">
              <h2 className="faculty-dashboard__timetable-title">Timetable</h2>
              <div className="faculty-dashboard__timetable-info">
                <span>Academic Year: {timetableData?.academic_year || '—'}</span>
                <span>Semester: {timetableData?.semester || '—'}</span>
              </div>
            </div>
            {!timetableData ? (
              <div className="faculty-dashboard__no-data">No timetable.</div>
            ) : (
              <div className="faculty-dashboard__timetable-grid">
                <table className="faculty-dashboard__timetable-table">
                  <thead>
                    <tr>
                      <th>Day / Period</th>
                      {periods.map((p) => (
                        <th key={p.period_id} className="faculty-dashboard__period-th"
                          style={p.period_type === 'break' ? { background: '#fef3c7' } : undefined}>
                          <span className="faculty-dashboard__period-name">{p.period_type === 'break' ? p.period_name : p.period_id}</span>
                          <span className="faculty-dashboard__period-time">{p.start_time} – {p.end_time}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day}>
                        <td style={{ fontWeight: 600 }}>{day}</td>
                        {periods.map((pObj) => {
                          const period = pObj.period_id;
                          if (pObj.period_type === 'break') {
                            return (
                              <td key={period} style={{ background: '#fefce8', textAlign: 'center' }}>
                                <strong style={{ color: '#92400e', fontSize: 12 }}>{pObj.period_name}</strong>
                              </td>
                            );
                          }
                          const cell = timetableData.timetable_data?.[day]?.[period] || {};
                          const sub = cell.subject || '';
                          const cls = cell.class_name || cell.class || '';
                          const room = cell.room || cell.room_name || cell.room_id || '';
                          const allFilled = !!sub && !!cls && !!room;
                          return (
                            <td key={period}>
                              {allFilled ? (
                                <>
                                  <div style={{ fontWeight: 600 }}>{sub}</div>
                                  <div style={{ fontSize: 11, color: 'var(--presence-secondary)' }}>{cls}</div>
                                  <div style={{ fontSize: 10, color: 'var(--presence-text-muted)' }}>{room}</div>
                                </>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Edit Timetable */}
        <div className={`faculty-dashboard__page ${currentPage === 'edit-timetable' ? 'active' : ''}`}>
          <div className="faculty-dashboard__content-header">
            <h1 className="faculty-dashboard__page-title">Create Timetable</h1>
          </div>
          <TimetableForm />
        </div>

        {/* View Attendance */}
        <div className={`faculty-dashboard__page ${currentPage === 'view-attendance' ? 'active' : ''}`}>
          <div className="faculty-dashboard__content-header">
            <h1 className="faculty-dashboard__page-title">View Attendance</h1>
          </div>
          <div className="faculty-dashboard__attendance-wrap">
            <div className="faculty-dashboard__filters">
              <label className="faculty-dashboard__filter">
                <span>Class (batch)</span>
                <select
                  value={viewBatch}
                  onChange={(e) => {
                    setViewBatch(e.target.value);
                    setViewSubject('');
                    setViewClassId('');
                    setAttendanceSummary(null);
                    setAttendanceSummaryError('');
                  }}
                  disabled={viewBatchOptions.length === 0}
                >
                  <option value="">—</option>
                  {viewBatchOptions.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="faculty-dashboard__filter">
                <span>Subject</span>
                <select
                  value={viewSubject}
                  onChange={(e) => {
                    setViewSubject(e.target.value);
                    setAttendanceSummaryError('');
                  }}
                  disabled={!viewBatch || viewSubjectOptionsForBatch.length === 0}
                >
                  <option value="">—</option>
                  {viewSubjectOptionsForBatch.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              {viewBatch && viewSubject && viewClassMatches.length > 1 && (
                <label className="faculty-dashboard__filter">
                  <span>Day &amp; period</span>
                  <select
                    value={viewClassId}
                    onChange={(e) => setViewClassId(e.target.value)}
                    disabled={viewClassMatches.length === 0}
                  >
                    <option value="">—</option>
                    {viewClassMatches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {formatViewSlotLabel(c, periods)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {attendanceSummaryError && (
              <p className="faculty-dashboard__error-text">{attendanceSummaryError}</p>
            )}

            {attendanceSummary && !attendanceSummaryLoading && (
              <>
                <div className="faculty-dashboard__summary-meta">
                  <strong>{attendanceSummary.subject_name}</strong>
                  {attendanceSummary.subject_code && (
                    <span> ({attendanceSummary.subject_code})</span>
                  )}
                  <span> · {attendanceSummary.class_code}</span>
                  {attendanceSummary.batch && <span> · {attendanceSummary.batch}</span>}
                </div>
                <table className="faculty-dashboard__attendance-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Absent</th>
                      <th>Total sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceSummary.students.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="faculty-dashboard__no-data">
                          —
                        </td>
                      </tr>
                    ) : (
                      attendanceSummary.students.map((row) => (
                        <tr key={row.email + row.student_id}>
                          <td>{row.student_id}</td>
                          <td>{row.name}</td>
                          <td>{row.email}</td>
                          <td>{row.present}</td>
                          <td>{row.late}</td>
                          <td>{row.absent}</td>
                          <td>{row.total_sessions}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            )}

          </div>
        </div>

        {/* My Classes */}
        <div className={`faculty-dashboard__page ${currentPage === 'my-classes' ? 'active' : ''}`}>
          <div className="faculty-dashboard__content-header">
            <h1 className="faculty-dashboard__page-title">My Classes</h1>
          </div>

          <section className="faculty-dashboard__recent-section" aria-labelledby="recent-classes-heading">
            <h2 id="recent-classes-heading" className="faculty-dashboard__recent-section-title">
              Recent classes
            </h2>
            {recentClasses.length === 0 ? (
              <p className="faculty-dashboard__recent-empty">—</p>
            ) : (
              <div className="faculty-dashboard__table-wrap faculty-dashboard__recent-list-wrap">
                <table className="faculty-dashboard__recent-classes-table">
                  <thead>
                    <tr>
                      <th>Class name</th>
                      <th>Period</th>
                      <th>Period timing</th>
                      <th>Date of class taken</th>
                      <th className="faculty-dashboard__recent-classes-table__actions"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentClasses.map((c) => {
                      const { dayAbbrev, periodId } = parseTimetableClassCode(c.class_code);
                      const dayLabel = dayAbbrev ? DAY_ABBREV_LABEL[dayAbbrev] || dayAbbrev : null;
                      const periodLine = [dayLabel || dayAbbrev, periodDisplayLabel(periodId, periods)]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <tr key={c.id}>
                          <td>
                            <div className="faculty-dashboard__recent-class-name">
                              {c.batch || c.class_code || '—'}
                            </div>
                            {c.subject_name && (
                              <div className="faculty-dashboard__recent-class-subject">{c.subject_name}</div>
                            )}
                          </td>
                          <td>{periodLine || '—'}</td>
                          <td>{formatPeriodTiming(c.start_time, c.end_time)}</td>
                          <td>{formatSessionDate(c.last_activity_date)}</td>
                          <td className="faculty-dashboard__recent-classes-table__actions">
                            <button
                              type="button"
                              className="faculty-dashboard__recent-view-btn"
                              onClick={() => loadClassStudents(c.id)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="faculty-dashboard__classes-layout">
            <div className="faculty-dashboard__class-list-card">
              <h2>Classes from Timetable</h2>
              {classList.length === 0 ? (
                <p style={{ color: 'var(--presence-text-muted)', fontSize: 14 }}>—</p>
              ) : (
                classList.map((c) => {
                  const { dayAbbrev, periodId } = parseTimetableClassCode(c.class_code);
                  const dayLabel = dayAbbrev ? DAY_ABBREV_LABEL[dayAbbrev] || dayAbbrev : null;
                  const periodLine = [dayLabel || dayAbbrev, periodDisplayLabel(periodId, periods)]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <div
                      key={c.id}
                      className={`faculty-dashboard__timetable-class-row ${selectedClassId === c.id ? 'selected' : ''}`}
                    >
                      <div className="faculty-dashboard__timetable-class-row-main">
                        <div className="faculty-dashboard__timetable-class-name">
                          {c.batch || c.class_code || 'Class'}
                        </div>
                        {c.subject_name && (
                          <div className="faculty-dashboard__timetable-class-subject">{c.subject_name}</div>
                        )}
                        <div className="faculty-dashboard__timetable-class-meta">
                          <span>{periodLine || '—'}</span>
                          <span className="faculty-dashboard__timetable-class-meta-sep"> · </span>
                          <span>{formatPeriodTiming(c.start_time, c.end_time)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="faculty-dashboard__timetable-enroll-btn"
                        onClick={() => loadClassStudents(c.id)}
                      >
                        View enrolled students
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {selectedClassId && (
            <div
              className="faculty-dashboard__class-modal-overlay"
              role="presentation"
              onClick={closeClassStudentsModal}
            >
              <div
                className="faculty-dashboard__class-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="class-modal-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="faculty-dashboard__class-modal-header">
                  <h2 id="class-modal-title" className="faculty-dashboard__class-modal-title">
                    {lastSessionLoading || !classDetail
                      ? 'Enrolled students'
                      : classDetail.subject_name || 'Class'}
                  </h2>
                  <button
                    type="button"
                    className="faculty-dashboard__class-modal-close"
                    aria-label="Close"
                    onClick={closeClassStudentsModal}
                  >
                    ×
                  </button>
                </div>
                <div className="faculty-dashboard__class-modal-body">
                  {!lastSessionLoading && !classDetail && (
                    <p className="faculty-dashboard__class-modal-muted">—</p>
                  )}
                  {!lastSessionLoading && classDetail && (
                    <>
                      <p className="faculty-dashboard__class-modal-meta">
                        {classDetail.class_code}
                        {classDetail.batch ? ` · ${classDetail.batch}` : ''}
                      </p>
                      {!classDetail.students?.length ? (
                        <p className="faculty-dashboard__class-modal-muted">—</p>
                      ) : (
                        <>
                          <div className="faculty-dashboard__table-wrap">
                            <table className="faculty-dashboard__last-session-table">
                              <thead>
                                <tr>
                                  <th>Student ID</th>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>Last session</th>
                                  <th>Present / Absent</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {classDetail.students.map((s) => (
                                  <tr key={s.student_db_id || s.student_id}>
                                    <td>{s.student_id}</td>
                                    <td>{s.name}</td>
                                    <td>{s.email}</td>
                                    <td>{s.last_session_date || '—'}</td>
                                    <td>{presentAbsentLabel(s.status)}</td>
                                    <td>
                                      <span
                                        className={`faculty-dashboard__status-badge faculty-dashboard__status-badge--${lastSessionBadgeModifier(s.status)}`}
                                      >
                                        {s.status_label || '—'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
