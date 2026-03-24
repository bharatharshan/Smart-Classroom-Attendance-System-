import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const COL = {
  present: '#20b1ab',
  late: '#f59e0b',
  absent: '#ef4444',
  rate: '#0d9488',
  enrolled: '#94a3b8',
  marked: '#20b1ab',
};

const AXIS_TICK = { fontSize: 11 };

function SpacedLegend({ payload }) {
  if (!payload || !payload.length) return null;
  return (
    <ul className="faculty-charts__legend-row">
      {payload.map((entry, i) => (
        <li key={`${entry.dataKey}-${i}`} className="faculty-charts__legend-item">
          <span className="faculty-charts__legend-swatch" style={{ background: entry.color }} />
          <span className="faculty-charts__legend-text" style={{ color: entry.color }}>
            {entry.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ChartCard({ title, controls, children, empty }) {
  if (empty) {
    return (
      <div className="faculty-charts__card">
        <h3 className="faculty-charts__title">{title}</h3>
        {controls}
        <div className="faculty-charts__empty">—</div>
      </div>
    );
  }
  return (
    <div className="faculty-charts__card">
      <h3 className="faculty-charts__title">{title}</h3>
      {controls}
      <div className="faculty-charts__plot">{children}</div>
    </div>
  );
}

export default function FacultyDashboardCharts({ data, loading, error }) {
  const [todaySubject, setTodaySubject] = useState('__all__');

  useEffect(() => {
    setTodaySubject('__all__');
  }, [data]);

  const subjectOptionsMerged = useMemo(() => {
    if (!data) return [];
    const s = new Set();
    const subjMap = data.status_stacked_by_subject;
    if (subjMap && typeof subjMap === 'object') {
      Object.keys(subjMap).forEach((k) => {
        if (k !== '__all__') s.add(k);
      });
    }
    (data.status_stacked_today || []).forEach((r) => {
      const n = r.subject_name;
      if (n && n !== '—') s.add(n);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [data]);

  const todayStackFiltered = useMemo(() => {
    if (!data) return [];
    const raw = data.status_stacked_today || [];
    if (todaySubject === '__all__') return raw;
    return raw.filter((r) => (r.subject_name || '') === todaySubject);
  }, [data, todaySubject]);

  if (loading) {
    return <div className="faculty-charts__loading">…</div>;
  }
  if (error) {
    return <div className="faculty-charts__error">{error}</div>;
  }
  if (!data) return null;

  const w = data.weekly_trend || [];
  const d = data.daily_trend || [];
  const todayRaw = data.today_enrollment_vs_marked || [];
  const today = todayRaw.map((row) => ({
    ...row,
    chart_label: row.chart_label || row.subject_code || '—',
  }));

  const thr = data.at_risk_threshold_percent ?? 75;
  const atRisk = data.students_at_risk || [];
  const top = data.top_attenders || [];
  const chronic = data.chronic_absentees || [];

  const todayChartControls =
    subjectOptionsMerged.length > 0 ? (
      <div className="faculty-charts__toolbar faculty-charts__toolbar--in-card">
        <label htmlFor="faculty-chart-subject-today">Subject</label>
        <select
          id="faculty-chart-subject-today"
          className="faculty-charts__select"
          value={todaySubject}
          onChange={(e) => setTodaySubject(e.target.value)}
        >
          <option value="__all__">All</option>
          {subjectOptionsMerged.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  return (
    <div className="faculty-charts">
      <div className="faculty-charts__grid">
        <ChartCard
          title="Today: status"
          controls={todayChartControls}
          empty={todayStackFiltered.length === 0}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={todayStackFiltered} margin={{ top: 8, right: 12, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="chart_label"
                tick={AXIS_TICK}
                interval={0}
                angle={todayStackFiltered.length > 6 ? -25 : 0}
                textAnchor={todayStackFiltered.length > 6 ? 'end' : 'middle'}
                height={todayStackFiltered.length > 6 ? 56 : 40}
              />
              <YAxis tick={AXIS_TICK} />
              <Tooltip />
              <Legend content={(props) => <SpacedLegend {...props} />} verticalAlign="bottom" />
              <Bar dataKey="present" stackId="a" fill={COL.present} name="Present" />
              <Bar dataKey="late" stackId="a" fill={COL.late} name="Late" />
              <Bar dataKey="absent" stackId="a" fill={COL.absent} name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Today: enrolled vs marked" empty={today.length === 0}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={today} margin={{ top: 8, right: 12, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="chart_label" tick={AXIS_TICK} interval={0} textAnchor="middle" height={48} />
              <YAxis tick={AXIS_TICK} />
              <Tooltip />
              <Legend content={(props) => <SpacedLegend {...props} />} verticalAlign="bottom" />
              <Bar dataKey="enrolled" name="Enrolled" fill={COL.enrolled} />
              <Bar dataKey="marked" name="Marked today" fill={COL.marked} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly rate" empty={w.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={w} margin={{ top: 8, right: 12, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="rate_percent" name="Rate %" stroke={COL.rate} strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily rate" empty={d.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={d} margin={{ top: 8, right: 12, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} />
              <Tooltip />
              <Line type="monotone" dataKey="rate_percent" name="Rate %" stroke={COL.rate} strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="faculty-charts__card faculty-charts__card--full">
          <h3 className="faculty-charts__title">At risk</h3>
          {atRisk.length === 0 ? (
            <div className="faculty-charts__empty">—</div>
          ) : (
            <ul className="faculty-charts__list">
              {atRisk.map((s) => (
                <li key={s.student_db_id}>
                  <span>{s.label}</span>
                  <strong style={{ color: COL.absent }}>{s.rate_percent}%</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="faculty-charts__card faculty-charts__card--split">
          <div>
            <h3 className="faculty-charts__title">Top attenders</h3>
            {top.length === 0 ? (
              <div className="faculty-charts__empty">—</div>
            ) : (
              <ul className="faculty-charts__list">
                {top.map((s) => (
                  <li key={s.student_db_id}>
                    <span>{s.label}</span>
                    <strong>{s.rate_percent}%</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="faculty-charts__title">Lowest rate</h3>
            {chronic.length === 0 ? (
              <div className="faculty-charts__empty">—</div>
            ) : (
              <ul className="faculty-charts__list">
                {chronic.map((s) => (
                  <li key={`c-${s.student_db_id}`}>
                    <span>{s.label}</span>
                    <strong style={{ color: s.rate_percent < thr ? COL.absent : undefined }}>{s.rate_percent}%</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
