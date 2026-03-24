import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './AuthPages.css';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (username === 'user' && password === 'user123') {
        // Simple local admin session; can be replaced with real API later
        localStorage.setItem('admin_logged_in', 'true');
        navigate('/admin');
      } else {
        setError('Invalid admin credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card auth-page__card--admin">
        <div className="auth-page__header">
          <span className="auth-page__logo">P+</span>
          <h1>Admin Login</h1>
          <p>PRESENCE+ Administration</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-page__form">
          {error && <div className="auth-page__error">{error}</div>}
          <div className="auth-page__field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user"
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
          <button type="submit" className="btn auth-page__submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-page__footer">
          Default admin: <strong>user / user123</strong>
        </p>
        <Link to="/" className="auth-page__back">← Back to Home</Link>
      </div>
    </div>
  );
}

