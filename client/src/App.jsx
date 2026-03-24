import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import StudentLogin from './pages/StudentLogin';
import StudentRegister from './pages/StudentRegister';
import FacultyLogin from './pages/FacultyLogin';
import FacultyRegister from './pages/FacultyRegister';
import FacultyDashboard from './pages/FacultyDashboard';
import { MarkAttendance } from './pages/MarkAttendance';
import { TimetableForm } from './components/TimetableForm';
import { StudentPortalLayout } from './pages/StudentPortalLayout';
import { StudentAvailableClasses } from './pages/StudentAvailableClasses';
import { StudentActiveSession } from './pages/StudentActiveSession';
import { StudentHistory } from './pages/StudentHistory';
import { StudentProfile } from './pages/StudentProfile';
import AdminLogin from './pages/AdminLogin';
import { AdminLayout } from './pages/AdminLayout';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminPeriods } from './pages/AdminPeriods';
import { AdminSubjects } from './pages/AdminSubjects';
import { AdminFaculty } from './pages/AdminFaculty';
import { AdminClassrooms } from './pages/AdminClassrooms';

function getFaceEmbedding(videoEl) {
  if (window.FaceEmbedding && typeof window.FaceEmbedding.getFaceDescriptorFromVideo === 'function') {
    return window.FaceEmbedding.getFaceDescriptorFromVideo(videoEl);
  }
  return Promise.resolve(null);
}

function RequireStudent({ children }) {
  const token = localStorage.getItem('student_token');
  if (!token) return <Navigate to="/student/login" replace />;
  return children;
}

function RequireFaculty({ children }) {
  const token = localStorage.getItem('faculty_token');
  if (!token) return <Navigate to="/faculty/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const loggedIn = localStorage.getItem('admin_logged_in') === 'true';
  if (!loggedIn) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/student/register" element={<StudentRegister />} />
        <Route path="/student/dashboard" element={<Navigate to="/student/portal" replace />} />
        <Route path="/student/portal" element={<RequireStudent><StudentPortalLayout /></RequireStudent>}>
          <Route index element={<StudentAvailableClasses />} />
          <Route path="session" element={<StudentActiveSession />} />
          <Route path="history" element={<StudentHistory />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>
        <Route path="/student/mark-attendance" element={<RequireStudent><MarkAttendance getFaceEmbedding={getFaceEmbedding} /></RequireStudent>} />
        <Route path="/faculty/login" element={<FacultyLogin />} />
        <Route path="/faculty/register" element={<FacultyRegister />} />
        <Route path="/faculty/dashboard" element={<RequireFaculty><FacultyDashboard /></RequireFaculty>} />
        <Route path="/faculty/timetable" element={<RequireFaculty><TimetableForm /></RequireFaculty>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminDashboard />} />
          <Route path="periods" element={<AdminPeriods />} />
          <Route path="subjects" element={<AdminSubjects />} />
          <Route path="faculty" element={<AdminFaculty />} />
          <Route path="classrooms" element={<AdminClassrooms />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
