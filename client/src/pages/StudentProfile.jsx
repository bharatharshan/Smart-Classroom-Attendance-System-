import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { classes as classesApi } from '../api';
import './StudentPortal.css';

export function StudentProfile() {
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();
  const [enrolledClasses, setEnrolledClasses] = useState([]);

  useEffect(() => {
    if (!user) return;
    classesApi
      .myBatch()
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setEnrolledClasses(arr.filter((c) => c.enrolled));
      })
      .catch(() => setEnrolledClasses([]));
  }, [user]);

  const initial = (user?.name || user?.email || 'P').charAt(0).toUpperCase();
  const regNo = user?.student_id || user?.id || '—';
  const classYear = user?.year || '—';

  return (
    <>
      <h1 className="student-portal__main-title">Profile</h1>
      <p className="student-portal__main-sub">Your registration and enrollment details</p>
      <div className="student-portal__card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1rem 0' }}>
          <div className="student-portal__avatar" style={{ width: 96, height: 96, fontSize: '2.5rem' }}>
            {user?.profile_photo ? (
              <img src={`data:image/jpeg;base64,${user.profile_photo}`} alt="Profile" />
            ) : (
              initial
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--presence-text-muted)' }}>
            {user?.face_enrolled ? 'Face captured during registration is used for attendance verification.' : 'Profile photo from registration can be shown here when stored.'}
          </p>
          <dl style={{ width: '100%', maxWidth: 320, margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--presence-border)' }}>
              <dt style={{ margin: 0, fontWeight: 600, color: 'var(--presence-text-muted)' }}>Reg no</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{regNo}</dd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--presence-border)' }}>
              <dt style={{ margin: 0, fontWeight: 600, color: 'var(--presence-text-muted)' }}>Class</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{classYear}</dd>
            </div>
            <div style={{ padding: '0.75rem 0' }}>
              <dt style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--presence-text-muted)' }}>Classes enrolled</dt>
              <dd style={{ margin: 0 }}>
                {enrolledClasses.length === 0 && <span style={{ color: 'var(--presence-text-muted)' }}>None</span>}
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {enrolledClasses.map((c) => (
                    <li key={c.id}>{c.subject_name} ({c.batch})</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <button type="button" className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => { localStorage.removeItem('student_token'); localStorage.removeItem('student_user'); navigate('/student/login'); }}>
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
