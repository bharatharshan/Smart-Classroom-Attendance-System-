import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { facultyAuth } from '../api';
import './AuthPages.css';

export default function FacultyRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    faculty_id: '',
    name: '',
    email: '',
    password: '',
    department: '',
    designation: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await facultyAuth.register(form);
      const token = res?.access_token;
      if (token) {
        localStorage.setItem('faculty_token', token);
        const user = await facultyAuth.me();
        localStorage.setItem('faculty_user', JSON.stringify(user));
      } else {
        const { access_token } = await facultyAuth.login(form.email, form.password);
        localStorage.setItem('faculty_token', access_token);
        const user = await facultyAuth.me();
        localStorage.setItem('faculty_user', JSON.stringify(user));
      }
      navigate('/faculty/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card auth-page__card--wide auth-page__card--faculty">
        <div className="auth-page__header">
          <span className="auth-page__logo">P+</span>
          <h1>Create Account</h1>
          <p>Faculty – PRESENCE+</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-page__form">
          {error && <div className="auth-page__error">{error}</div>}
          <div className="auth-page__row">
            <div className="auth-page__field">
              <label>Faculty ID</label>
              <input name="faculty_id" value={form.faculty_id} onChange={handleChange} placeholder="FAC001" required />
            </div>
            <div className="auth-page__field">
              <label>Full Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Dr. Jane Smith" required />
            </div>
          </div>
          <div className="auth-page__field">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          </div>
          <div className="auth-page__field">
            <label>Password (min 6)</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" minLength={6} required />
          </div>
          <div className="auth-page__row">
            <div className="auth-page__field">
              <label>Department</label>
              <input name="department" value={form.department} onChange={handleChange} placeholder="Computer Science" />
            </div>
            <div className="auth-page__field">
              <label>Designation</label>
              <input name="designation" value={form.designation} onChange={handleChange} placeholder="Assistant Professor" />
            </div>
          </div>
          <button type="submit" className="btn btn-secondary auth-page__submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-page__footer">
          Already have an account? <Link to="/faculty/login">Sign In</Link>
        </p>
        <Link to="/" className="auth-page__back">← Back to Home</Link>
      </div>
    </div>
  );
}
