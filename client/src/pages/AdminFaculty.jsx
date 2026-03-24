import React, { useState, useEffect } from 'react';
import { admin } from '../api';

export function AdminFaculty() {
  const [form, setForm] = useState({
    faculty_id: '',
    name: '',
    email: '',
    department: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchFaculty = async () => {
    try {
      const data = await admin.faculty.list();
      setFaculty(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Failed to load faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ faculty_id: '', name: '', email: '', department: '' });
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    if (!form.name || !form.email || !form.department) {
      setError('Name, email and department are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await admin.faculty.update(editingId, {
        name: form.name,
        email: form.email,
        department: form.department,
      });
      setSuccess('Faculty updated successfully');
      resetForm();
      await fetchFaculty();
    } catch (e) {
      setError(e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (f) => {
    setForm({
      faculty_id: f.faculty_id,
      name: f.name,
      email: f.email,
      department: f.department || '',
    });
    setEditingId(f.faculty_id);
    setError(null);
    setSuccess(null);
  };

  const handleToggle = async (facultyId) => {
    try {
      await admin.faculty.toggle(facultyId);
      await fetchFaculty();
    } catch (e) {
      setError(e.message || 'Toggle failed');
    }
  };

  const handleDelete = async (facultyId) => {
    if (!window.confirm(`Delete faculty "${facultyId}"? This cannot be undone.`)) return;
    try {
      await admin.faculty.delete(facultyId);
      setSuccess(`Faculty "${facultyId}" deleted`);
      if (editingId === facultyId) resetForm();
      await fetchFaculty();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  const renderStatusBadge = (isActive) => (
    <span
      className={`admin-portal__badge ${
        isActive ? 'admin-portal__badge--success' : 'admin-portal__badge--muted'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );

  return (
    <>
      <h1 className="admin-portal__main-title">Faculty Management</h1>
      <p className="admin-portal__main-sub">
        View registered faculty, edit details, activate/deactivate, or remove.
        Faculty register themselves via the Faculty Register page.
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

      {editingId && (
        <div className="admin-portal__card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Editing: {editingId}</h2>
          <form onSubmit={handleSubmit} className="admin-portal__form-grid">
            <div className="admin-portal__field">
              <label>Faculty ID</label>
              <input type="text" value={form.faculty_id} disabled />
            </div>
            <div className="admin-portal__field">
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div className="admin-portal__field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>
            <div className="admin-portal__field">
              <label>Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => handleChange('department', e.target.value)}
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
              {saving ? 'Saving...' : 'Update Faculty'}
            </button>
            <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={resetForm}>
              Cancel Edit
            </button>
          </div>
        </div>
      )}

      <div className="admin-portal__card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Registered Faculty</h2>
        {loading ? (
          <p style={{ color: '#666', padding: '1rem 0' }}>Loading faculty...</p>
        ) : faculty.length === 0 ? (
          <p className="admin-portal__card--empty">No faculty registered yet. Faculty can register via the Faculty Register page.</p>
        ) : (
          <table className="admin-portal__table">
            <thead>
              <tr>
                <th>Faculty ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map((f) => (
                <tr key={f.faculty_id}>
                  <td>{f.faculty_id}</td>
                  <td>{f.name}</td>
                  <td>{f.email}</td>
                  <td>{f.department || '—'}</td>
                  <td>{renderStatusBadge(f.is_active)}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleToggle(f.faculty_id)}
                    >
                      {f.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleEdit(f)}
                      style={{ marginLeft: '0.35rem' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleDelete(f.faculty_id)}
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
          Faculty register via the Faculty Register page. Use this panel to manage their status and details.
        </p>
      </div>
    </>
  );
}
