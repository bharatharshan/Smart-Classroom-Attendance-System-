import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { studentAuth } from '../api';
import './AuthPages.css';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await studentAuth.login(email, password);
      localStorage.setItem('student_token', access_token);
      const user = await studentAuth.me();
      localStorage.setItem('student_user', JSON.stringify(user));
      navigate('/student/portal');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <div className="auth-page__header">
          <span className="auth-page__logo">P+</span>
          <h1>Student Login</h1>
          <p>PRESENCE+ Smart Attendance</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-page__form">
          {error && <div className="auth-page__error">{error}</div>}
          <div className="auth-page__field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="auth-page__field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary auth-page__submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-page__footer">
          Don't have an account? <Link to="/student/register">Create Account</Link>
        </p>
        <Link to="/" className="auth-page__back">← Back to Home</Link>
      </div>
    </div>
  );
}
