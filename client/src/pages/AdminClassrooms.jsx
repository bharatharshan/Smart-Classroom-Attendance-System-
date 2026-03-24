import React, { useState, useEffect } from 'react';
import { admin } from '../api';

export function AdminClassrooms() {
  const [form, setForm] = useState({
    room_id: '',
    room_name: '',
    room_slug: 'cosol3',
    latitude: '',
    longitude: '',
    allowed_radius: '100',
  });
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchRooms = async () => {
    try {
      const data = await admin.classrooms.list();
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ room_id: '', room_name: '', room_slug: 'cosol3', latitude: '', longitude: '', allowed_radius: '100' });
    setEditingRoomId(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.room_id || !form.room_name || !form.latitude || !form.longitude || !form.allowed_radius) {
      setError('All fields are required');
      return;
    }

    const payload = {
      room_id: form.room_id,
      room_name: form.room_name,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      allowed_radius: parseFloat(form.allowed_radius),
      room_slug: form.room_slug?.trim() || null,
    };

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingRoomId) {
        await admin.classrooms.update(editingRoomId, {
          room_name: payload.room_name,
          latitude: payload.latitude,
          longitude: payload.longitude,
          allowed_radius: payload.allowed_radius,
          room_slug: payload.room_slug,
        });
        setSuccess('Classroom updated successfully');
      } else {
        await admin.classrooms.create(payload);
        setSuccess('Classroom added successfully');
      }
      resetForm();
      await fetchRooms();
    } catch (e) {
      setError(e.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (r) => {
    setForm({
      room_id: r.room_id,
      room_name: r.room_name,
      room_slug: r.room_slug || 'cosol3',
      latitude: String(r.latitude),
      longitude: String(r.longitude),
      allowed_radius: String(r.allowed_radius),
    });
    setEditingRoomId(r.room_id);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (room_id) => {
    if (!window.confirm(`Delete classroom "${room_id}"?`)) return;
    try {
      await admin.classrooms.delete(room_id);
      setSuccess(`Classroom "${room_id}" deleted`);
      if (editingRoomId === room_id) resetForm();
      await fetchRooms();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  return (
    <>
      <h1 className="admin-portal__main-title">Classroom Management</h1>
      <p className="admin-portal__main-sub">
        Define classroom GPS coordinates and allowed radius for geo-based attendance.
      </p>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: 14 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: 14 }}>
          {success}
        </div>
      )}

      <div className="admin-portal__card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>
          {editingRoomId ? `Editing: ${editingRoomId}` : 'Add New Classroom'}
        </h2>
        <form onSubmit={handleSubmit} className="admin-portal__form-grid">
          <div className="admin-portal__field">
            <label>Room ID</label>
            <input
              type="text"
              value={form.room_id}
              onChange={(e) => handleChange('room_id', e.target.value)}
              placeholder="101"
              required
              disabled={!!editingRoomId}
            />
          </div>
          <div className="admin-portal__field">
            <label>Room Name</label>
            <input
              type="text"
              value={form.room_name}
              onChange={(e) => handleChange('room_name', e.target.value)}
              placeholder="Room 101"
              required
            />
          </div>
          <div className="admin-portal__field">
            <label>Room slug (WiFi / venue key)</label>
            <input
              type="text"
              value={form.room_slug}
              onChange={(e) => handleChange('room_slug', e.target.value)}
              placeholder="cosol3"
              title="Must match keys in server room_network_prefixes (e.g. cosol3, 811)"
            />
          </div>
          <div className="admin-portal__field">
            <label>Latitude</label>
            <input
              type="number"
              step="0.0000001"
              value={form.latitude}
              onChange={(e) => handleChange('latitude', e.target.value)}
              placeholder="12.930001"
              required
            />
          </div>
          <div className="admin-portal__field">
            <label>Longitude</label>
            <input
              type="number"
              step="0.0000001"
              value={form.longitude}
              onChange={(e) => handleChange('longitude', e.target.value)}
              placeholder="77.604696"
              required
            />
          </div>
          <div className="admin-portal__field">
            <label>Allowed Radius (meters)</label>
            <input
              type="number"
              min="1"
              value={form.allowed_radius}
              onChange={(e) => handleChange('allowed_radius', e.target.value)}
              required
            />
          </div>
        </form>
        <div className="admin-portal__actions">
          <button
            type="button"
            className="admin-portal__btn admin-portal__btn--primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : editingRoomId ? 'Update Classroom' : 'Add Classroom'}
          </button>
          {editingRoomId && (
            <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="admin-portal__card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Configured Classrooms</h2>
        {loading ? (
          <p style={{ color: '#666', padding: '1rem 0' }}>Loading classrooms...</p>
        ) : rooms.length === 0 ? (
          <p className="admin-portal__card--empty">No classrooms configured yet.</p>
        ) : (
          <table className="admin-portal__table">
            <thead>
              <tr>
                <th>Room ID</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Radius (m)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.room_id}>
                  <td>{r.room_id}</td>
                  <td>{r.room_name}</td>
                  <td>{r.room_slug || '—'}</td>
                  <td>{r.latitude}</td>
                  <td>{r.longitude}</td>
                  <td>{r.allowed_radius}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleEdit(r)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleDelete(r.room_id)}
                      style={{ marginLeft: '0.35rem', color: '#dc2626', borderColor: 'rgba(248,113,113,0.5)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ fontSize: 12, color: 'var(--presence-text-muted)', marginTop: '0.75rem' }}>
          These coordinates are used by the attendance module to verify if students are inside the classroom geofence.
        </p>
      </div>
    </>
  );
}
