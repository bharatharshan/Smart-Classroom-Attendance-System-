import React, { useState, useEffect } from 'react';
import { admin } from '../api';

export function AdminSubjects() {
  const [form, setForm] = useState({
    subject_code: '',
    subject_name: '',
    course: '',
    semester: '',
  });
  const [editingCode, setEditingCode] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchSubjects = async () => {
    try {
      const data = await admin.subjects.list();
      setSubjects(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ subject_code: '', subject_name: '', course: '', semester: '' });
    setEditingCode(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject_code || !form.subject_name || !form.course || !form.semester) {
      setError('All fields are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingCode) {
        await admin.subjects.update(editingCode, {
          subject_name: form.subject_name,
          course: form.course,
          semester: form.semester,
        });
        setSuccess('Subject updated successfully');
      } else {
        await admin.subjects.create(form);
        setSuccess('Subject added successfully');
      }
      resetForm();
      await fetchSubjects();
    } catch (e) {
      setError(e.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s) => {
    setForm({
      subject_code: s.subject_code,
      subject_name: s.subject_name,
      course: s.course,
      semester: s.semester,
    });
    setEditingCode(s.subject_code);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Delete subject "${code}"?`)) return;
    try {
      await admin.subjects.delete(code);
      setSuccess(`Subject "${code}" deleted`);
      if (editingCode === code) resetForm();
      await fetchSubjects();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  };

  return (
    <>
      <h1 className="admin-portal__main-title">Subject Management</h1>
      <p className="admin-portal__main-sub">Create subjects and assign them to course and semester.</p>

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
          {editingCode ? `Editing: ${editingCode}` : 'Add New Subject'}
        </h2>
        <form onSubmit={handleSubmit} className="admin-portal__form-grid">
          <div className="admin-portal__field">
            <label>Subject Code</label>
            <input
              type="text"
              value={form.subject_code}
              onChange={(e) => handleChange('subject_code', e.target.value.toUpperCase())}
              placeholder="CS401"
              required
              disabled={!!editingCode}
            />
          </div>
          <div className="admin-portal__field">
            <label>Subject Name</label>
            <input
              type="text"
              value={form.subject_name}
              onChange={(e) => handleChange('subject_name', e.target.value)}
              placeholder="Distributed Systems"
              required
            />
          </div>
          <div className="admin-portal__field">
            <label>Course</label>
            <input
              type="text"
              value={form.course}
              onChange={(e) => handleChange('course', e.target.value)}
              placeholder="MCA"
              required
            />
          </div>
          <div className="admin-portal__field">
            <label>Semester</label>
            <input
              type="text"
              value={form.semester}
              onChange={(e) => handleChange('semester', e.target.value)}
              placeholder="6"
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
            {saving ? 'Saving...' : editingCode ? 'Update Subject' : 'Add Subject'}
          </button>
          {editingCode && (
            <button type="button" className="admin-portal__btn admin-portal__btn--ghost" onClick={resetForm}>
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="admin-portal__card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Configured Subjects</h2>
        {loading ? (
          <p style={{ color: '#666', padding: '1rem 0' }}>Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p className="admin-portal__card--empty">No subjects configured yet.</p>
        ) : (
          <table className="admin-portal__table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Course</th>
                <th>Semester</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject_code}>
                  <td>{s.subject_code}</td>
                  <td>{s.subject_name}</td>
                  <td>{s.course}</td>
                  <td>{s.semester}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleEdit(s)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-portal__btn admin-portal__btn--ghost"
                      onClick={() => handleDelete(s.subject_code)}
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
      </div>
    </>
  );
}
