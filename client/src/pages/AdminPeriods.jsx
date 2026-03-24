import React, { useState, useEffect } from 'react';
import { admin } from '../api';

function assignIds(list) {
  let classNum = 1;
  let breakNum = 1;
  return list.map((p, idx) => ({
    ...p,
    period_id: p.period_type === 'break' ? `BREAK${breakNum++}` : `P${classNum++}`,
    sort_order: idx,
  }));
}

export function AdminPeriods() {
  const [form, setForm] = useState({ period_name: '', start_time: '', end_time: '', period_type: 'class' });
  const [editingIdx, setEditingIdx] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchPeriods = async () => {
    try {
      const data = await admin.periods.list();
      const raw = Array.isArray(data) ? data : [];
      raw.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setPeriods(raw);
    } catch (e) {
      setError('Failed to load periods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPeriods(); }, []);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm({ period_name: '', start_time: '', end_time: '', period_type: 'class' });
    setEditingIdx(null);
    setError(null);
  };

  const displayed = assignIds(periods);

  const previewId = (() => {
    if (editingIdx !== null) {
      const modified = periods.map((p, i) =>
        i === editingIdx ? { ...p, period_type: form.period_type } : p
      );
      const withIds = assignIds(modified);
      return withIds[editingIdx]?.period_id || '—';
    }
    const withNew = [...periods, { period_type: form.period_type }];
    const withIds = assignIds(withNew);
    return withIds[withIds.length - 1]?.period_id || '—';
  })();

  const syncAll = async (newList) => {
    const withIds = assignIds(newList);
    const payload = withIds.map((p) => ({
      period_id: p.period_id,
      period_name: p.period_name,
      start_time: p.start_time,
      end_time: p.end_time,
      period_type: p.period_type,
      sort_order: p.sort_order,
    }));
    await admin.periods.sync(payload);
    await fetchPeriods();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.period_name || !form.start_time || !form.end_time) {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let newList;
      if (editingIdx !== null) {
        newList = periods.map((p, i) => i === editingIdx
          ? { period_name: form.period_name, start_time: form.start_time, end_time: form.end_time, period_type: form.period_type }
          : { period_name: p.period_name, start_time: p.start_time, end_time: p.end_time, period_type: p.period_type }
        );
        setSuccess('Period updated successfully');
      } else {
        newList = [
          ...periods.map((p) => ({ period_name: p.period_name, start_time: p.start_time, end_time: p.end_time, period_type: p.period_type })),
          { period_name: form.period_name, start_time: form.start_time, end_time: form.end_time, period_type: form.period_type },
        ];
        setSuccess('Period added successfully');
      }
      await syncAll(newList);
      resetForm();
    } catch (e) {
      setError(e.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (idx) => {
    const p = periods[idx];
    setForm({ period_name: p.period_name, start_time: p.start_time, end_time: p.end_time, period_type: p.period_type });
    setEditingIdx(idx);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (idx) => {
    const p = displayed[idx];
    if (!window.confirm(`Delete "${p.period_id} — ${p.period_name}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const newList = periods.filter((_, i) => i !== idx).map((pp) => ({
        period_name: pp.period_name, start_time: pp.start_time, end_time: pp.end_time, period_type: pp.period_type,
      }));
      await syncAll(newList);
      setSuccess('Period deleted — IDs re-sequenced');
      if (editingIdx === idx) resetForm();
      else if (editingIdx !== null && editingIdx > idx) setEditingIdx(editingIdx - 1);
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveUp = async (idx) => {
    if (idx <= 0) return;
    const newList = [...periods];
    [newList[idx - 1], newList[idx]] = [newList[idx], newList[idx - 1]];
    await syncAll(newList.map((p) => ({ period_name: p.period_name, start_time: p.start_time, end_time: p.end_time, period_type: p.period_type })));
  };

  const handleMoveDown = async (idx) => {
    if (idx >= periods.length - 1) return;
    const newList = [...periods];
    [newList[idx], newList[idx + 1]] = [newList[idx + 1], newList[idx]];
    await syncAll(newList.map((p) => ({ period_name: p.period_name, start_time: p.start_time, end_time: p.end_time, period_type: p.period_type })));
  };

  return (
    <>
      <h1 className="admin-portal__main-title">Period Management</h1>
      <p className="admin-portal__main-sub">
        Manage your timetable slots. Periods stay in their table position. IDs auto-assign: class → P1, P2... break → BREAK1, BREAK2...
      </p>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: 14 }}>{error}</div>
      )}
      {success && (
        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: 14 }}>{success}</div>
      )}

      <div className="admin-portal__card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
          {editingIdx !== null ? `Editing: Position ${editingIdx + 1} (${displayed[editingIdx]?.period_id})` : 'Add New Period'}
        </h2>
        <form onSubmit={handleSubmit} className="admin-portal__form-grid">
          <div className="admin-portal__field">
            <label>Type</label>
            <select value={form.period_type} onChange={(e) => handleChange('period_type', e.target.value)}>
              <option value="class">Class</option>
              <option value="break">Break</option>
            </select>
          </div>
          <div className="admin-portal__field">
            <label>Assigned ID (auto)</label>
            <input type="text" value={previewId} disabled style={{ background: '#f1f5f9', color: '#475569', fontWeight: 600 }} />
          </div>
          <div className="admin-portal__field">
            <label>Period Name</label>
            <input type="text" value={form.period_name} onChange={(e) => handleChange('period_name', e.target.value)}
              placeholder={form.period_type === 'break' ? 'Morning Break' : 'Period 1'} required />
          </div>
          <div className="admin-portal__field">
            <label>Start Time</label>
            <input type="time" value={form.start_time} onChange={(e) => handleChange('start_time', e.target.value)} required />
          </div>
          <div className="admin-portal__field">
            <label>End Time</label>
            <input type="time" value={form.end_time} onChange={(e) => handleChange('end_time', e.target.value)} required />
          </div>
        </form>
        <div className="admin-portal__actions">
          <button type="button" className="admin-portal__btn admin-portal__btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : editingIdx !== null ? 'Update Period' : 'Add Period'}
          </button>
          {editingIdx !== null && (
            <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={resetForm}>Cancel Edit</button>
          )}
        </div>
      </div>

      <div className="admin-portal__card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Configured Periods</h2>
        {loading ? (
          <p style={{ color: '#666', padding: '1rem 0' }}>Loading periods...</p>
        ) : displayed.length === 0 ? (
          <p className="admin-portal__card--empty">No periods configured yet.</p>
        ) : (
          <table className="admin-portal__table">
            <thead>
              <tr><th>#</th><th>ID</th><th>Name</th><th>Start</th><th>End</th><th>Type</th><th>Order</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {displayed.map((p, idx) => (
                <tr key={idx} style={editingIdx === idx ? { background: '#eff6ff' } : undefined}>
                  <td style={{ color: '#94a3b8', fontSize: 13 }}>{idx + 1}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                      background: p.period_type === 'break' ? '#fef3c7' : '#dbeafe',
                      color: p.period_type === 'break' ? '#92400e' : '#1e40af',
                    }}>{p.period_id}</span>
                  </td>
                  <td>{p.period_name}</td>
                  <td>{p.start_time}</td>
                  <td>{p.end_time}</td>
                  <td>{p.period_type === 'break' ? 'Break' : 'Class'}</td>
                  <td>
                    <button type="button" className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleMoveUp(idx)} disabled={idx === 0} style={{ padding: '2px 6px', fontSize: 14 }}>↑</button>
                    <button type="button" className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleMoveDown(idx)} disabled={idx === displayed.length - 1} style={{ padding: '2px 6px', fontSize: 14, marginLeft: 2 }}>↓</button>
                  </td>
                  <td>
                    <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={() => handleEdit(idx)}>Edit</button>
                    <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={() => handleDelete(idx)}
                      style={{ marginLeft: '0.35rem', color: '#dc2626', borderColor: 'rgba(248,113,113,0.5)' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
