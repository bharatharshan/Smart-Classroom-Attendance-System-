import React, { useEffect, useMemo, useState } from 'react';
import { admin } from '../api';

const DEFAULT_TREND = [
  { label: 'Mon', count: 0 },
  { label: 'Tue', count: 0 },
  { label: 'Wed', count: 0 },
  { label: 'Thu', count: 0 },
  { label: 'Fri', count: 0 },
];

export function AdminDashboard() {
  const [stats, setStats] = useState({
    students: '—',
    faculty: '—',
    classesToday: '—',
    classrooms: '—',
  });
  const [weekTrend, setWeekTrend] = useState(DEFAULT_TREND);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await admin.stats();
        if (!cancelled) {
          setStats({
            students: data.students_count ?? 0,
            faculty: data.faculty_count ?? 0,
            classesToday: data.classes_today ?? 0,
            classrooms: data.classrooms_count ?? 0,
          });
        }
      } catch {
        if (!cancelled) {
          setStats({
            students: '—',
            faculty: '—',
            classesToday: '—',
            classrooms: '—',
          });
        }
      }
      try {
        const trend = await admin.attendanceWeekTrend();
        if (!cancelled) {
          const days = Array.isArray(trend?.days) ? trend.days : [];
          if (days.length === 5) {
            setWeekTrend(days.map((d) => ({ label: d.label, count: Number(d.count) || 0 })));
          } else {
            setWeekTrend(DEFAULT_TREND);
          }
        }
      } catch {
        if (!cancelled) setWeekTrend(DEFAULT_TREND);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxCount = useMemo(() => Math.max(1, ...weekTrend.map((d) => d.count)), [weekTrend]);
  const chartHeight = 120;

  return (
    <>
      <h1 className="admin-portal__main-title">Admin Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="admin-portal__card">
          <div style={{ fontSize: 12, color: 'var(--presence-text-muted)' }}>Students Registered</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{stats.students}</div>
        </div>
        <div className="admin-portal__card">
          <div style={{ fontSize: 12, color: 'var(--presence-text-muted)' }}>Faculty Registered</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{stats.faculty}</div>
        </div>
        <div className="admin-portal__card">
          <div style={{ fontSize: 12, color: 'var(--presence-text-muted)' }}>Active Classes Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{stats.classesToday}</div>
        </div>
        <div className="admin-portal__card">
          <div style={{ fontSize: 12, color: 'var(--presence-text-muted)' }}>Classrooms Configured</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{stats.classrooms}</div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="admin-portal__card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Attendance (this week)</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: chartHeight }}>
            {weekTrend.map((d) => {
              const barH = maxCount ? (d.count / maxCount) * chartHeight : 0;
              return (
                <div key={d.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      height: Math.max(barH, d.count > 0 ? 4 : 0),
                      background: 'rgba(7,105,254,0.35)',
                      borderRadius: 6,
                      transition: 'height 0.3s ease',
                    }}
                    title={`${d.count}`}
                  />
                  <div style={{ fontSize: 11, marginTop: 6, color: 'var(--presence-text-muted)' }}>{d.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{d.count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
