import React, { useState, useEffect } from 'react';
import { timetable as timetableApi, classrooms as classroomsApi, admin } from '../api';
import { TimetableSlot } from './TimetableSlot';
import './TimetableForm.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function emptyTimetableData(periodIds) {
  const data = {};
  DAYS.forEach((day) => {
    data[day] = {};
    periodIds.forEach((p) => { data[day][p] = {}; });
  });
  return data;
}


/**
 * Faculty timetable edit form with room selection per slot.
 * If no active timetable exists, shows empty grid so faculty can create one.
 */
export function TimetableForm() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [roomList, setRoomList] = useState([]);
  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    Promise.all([
      admin.periods.list().catch(() => []),
      timetableApi.getActive().catch(() => null),
      classroomsApi.list().catch(() => []),
    ]).then(([periodData, tt, rooms]) => {
      const allPeriods = Array.isArray(periodData) ? periodData : [];
      allPeriods.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setPeriods(allPeriods);
      setRoomList(Array.isArray(rooms) ? rooms : []);

      const periodIds = allPeriods.filter((p) => p.period_type === 'class').map((p) => p.period_id);
      if (tt) {
        setData(tt);
      } else {
        setData({
          timetable_data: emptyTimetableData(periodIds),
          academic_year: '2025-2026',
          semester: 'Odd',
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const updateSlot = (day, period, newSlot) => {
    if (!data) return;
    const next = { ...data, timetable_data: { ...data.timetable_data } };
    if (!next.timetable_data[day]) next.timetable_data[day] = {};
    next.timetable_data[day][period] = newSlot;
    setData(next);
  };

  const classPeriodIds = periods.filter((p) => p.period_type === 'class').map((p) => p.period_id);
  const allPeriodIds = periods.map((p) => p.period_id);

  const handleSave = () => {
    setSaveError(null);

    const problems = [];
    if (data?.timetable_data) {
      DAYS.forEach((day) => {
        classPeriodIds.forEach((period) => {
          const slot = data.timetable_data?.[day]?.[period] || {};
          const hasSubject = !!(slot.subject && String(slot.subject).trim());
          const hasClass = !!(slot.class_name && String(slot.class_name).trim());
          const hasRoom = !!(slot.room_id && String(slot.room_id).trim());
          const anyFilled = hasSubject || hasClass || hasRoom;
          const allFilled = hasSubject && hasClass && hasRoom;
          if (anyFilled && !allFilled) {
            const missing = [];
            if (!hasSubject) missing.push('Subject');
            if (!hasClass) missing.push('Class');
            if (!hasRoom) missing.push('Room');
            problems.push(`${day} ${period}: missing ${missing.join(', ')}`);
          }
        });
      });
    }
    if (problems.length > 0) {
      setSaveError(`Please complete all required fields in the highlighted slots:\n${problems.join('\n')}`);
      return;
    }

    setSaving(true);

    const backendData = {};
    DAYS.forEach((day) => {
      backendData[day] = {};
      periods.forEach((p) => {
        if (p.period_type === 'break') {
          backendData[day][p.period_id] = { is_break: true, subject: p.period_name };
        } else {
          backendData[day][p.period_id] = data.timetable_data?.[day]?.[p.period_id] || {};
        }
      });
    });

    const payload = {
      timetable_data: backendData,
      academic_year: data.academic_year || '2025-2026',
      semester: data.semester || 'Odd',
    };
    if (data.id) {
      timetableApi
        .update(data.id, payload)
        .then((updated) => setData(updated))
        .catch((err) => setSaveError(err.message || 'Save failed'))
        .finally(() => setSaving(false));
    } else {
      timetableApi
        .create(payload)
        .then((created) => setData(created))
        .catch((err) => setSaveError(err.message || 'Create failed'))
        .finally(() => setSaving(false));
    }
  };

  if (loading) return <p className="timetable-form__loading">Loading timetable...</p>;

  return (
    <div className="timetable-form">
      <h2 className="timetable-form__title">Timetable</h2>
      {!data?.id && (
        <p className="timetable-form__hint">
          No active timetable yet. Fill the grid below and click Save to create one.
        </p>
      )}
      {saveError && <p className="timetable-form__error">{saveError}</p>}
      <div
        className="timetable-form__grid"
        style={{ gridTemplateColumns: `140px repeat(${allPeriodIds.length}, minmax(160px, 1fr))` }}
      >
        <div />
        {periods.map((p) => (
          <div key={p.period_id} className="timetable-form__grid-head-cell"
            style={p.period_type === 'break' ? { background: '#fef3c7' } : undefined}>
            <div>{p.period_type === 'break' ? p.period_name : p.period_id}</div>
            <div style={{ fontSize: 10, color: '#888' }}>{p.start_time} – {p.end_time}</div>
          </div>
        ))}
        {DAYS.map((day) => (
          <React.Fragment key={day}>
            <div className="timetable-form__day-label" data-day={day}>{day}</div>
            {periods.map((pObj) => {
              if (pObj.period_type === 'break') {
                return (
                  <div key={`${day}-${pObj.period_id}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fefce8', borderRadius: 8, minHeight: 80, fontWeight: 600, color: '#92400e', fontSize: 13 }}>
                    {pObj.period_name}
                  </div>
                );
              }
              return (
                <TimetableSlot
                  key={`${day}-${pObj.period_id}`}
                  slot={data?.timetable_data?.[day]?.[pObj.period_id] || {}}
                  onChange={(newSlot) => updateSlot(day, pObj.period_id, newSlot)}
                  roomList={roomList}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <button type="button" className="btn btn-secondary timetable-form__save" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : data?.id ? 'Save timetable' : 'Create timetable'}
      </button>
    </div>
  );
}
