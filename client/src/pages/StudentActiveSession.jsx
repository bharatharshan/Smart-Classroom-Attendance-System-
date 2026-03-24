import React from 'react';
import { useNavigate } from 'react-router-dom';

export function StudentActiveSession() {
  const navigate = useNavigate();
  return (
    <>
      <h1 className="student-portal__main-title">Active Session</h1>
      <p className="student-portal__main-sub">Mark your attendance for the current class</p>
      <div className="student-portal__card">
        <p style={{ marginBottom: '1rem', color: 'var(--presence-text-muted)' }}>
          When a class is in the attendance window (0–10 minutes after start), you can mark attendance from Available Classes or here.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/student/mark-attendance')}>
          Go to Mark Attendance
        </button>
      </div>
    </>
  );
}
