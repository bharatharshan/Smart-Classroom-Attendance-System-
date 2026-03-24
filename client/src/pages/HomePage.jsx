import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="presence-home">
      <div className="presence-home__bg" />
      <div className="presence-home__shapes" aria-hidden="true" />
      <div className="presence-home__content">
        <div className="presence-home__logo">
          <span className="presence-home__logo-icon">P+</span>
        </div>
        <h1 className="presence-home__title">PRESENCE+</h1>
        <p className="presence-home__subtitle">Smart Attendance System</p>
        <p className="presence-home__description">
          Mark attendance with face verification and location. Secure, fast, and designed for modern classrooms. Choose your role below to get started.
        </p>
        <div className="presence-home__actions">
          <Link
            to="/student/login"
            className="presence-home__btn presence-home__btn--student"
          >
            <span className="presence-home__btn-icon">👤</span>
            Student
          </Link>
          <Link
            to="/faculty/login"
            className="presence-home__btn presence-home__btn--faculty"
          >
            <span className="presence-home__btn-icon">👨‍🏫</span>
            Faculty
          </Link>
          <Link
            to="/admin/login"
            className="presence-home__btn presence-home__btn--admin"
          >
            <span className="presence-home__btn-icon">🛠️</span>
            Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
