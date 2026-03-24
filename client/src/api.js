/**
 * Default `/api` is rewritten by Vite to `http://localhost:8000` (no /api on FastAPI).
 * If you set VITE_API_BASE to the backend URL, use http://host:8000 — NOT .../8000/api
 * or every route becomes /api/faculty/... on the server → 404.
 */
function resolveApiBase() {
  const raw = import.meta.env.VITE_API_BASE;
  if (raw == null || String(raw).trim() === '') return '/api';
  const s = String(raw).trim().replace(/\/$/, '');
  const m = s.match(/^(https?:\/\/[^/]+)\/api$/i);
  if (m) {
    console.warn(
      '[api] VITE_API_BASE must not end with /api when pointing at FastAPI. Using',
      m[1],
      '(see client README).'
    );
    return m[1];
  }
  return s;
}
const API_BASE = resolveApiBase();

function getToken() {
  return localStorage.getItem('student_token') || localStorage.getItem('faculty_token');
}

function getStudentToken() {
  return localStorage.getItem('student_token');
}

function getFacultyToken() {
  return localStorage.getItem('faculty_token');
}

export async function api(method, path, body, opts = {}) {
  const headers = { ...opts.headers };
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = opts.token ?? getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || res.statusText);
  return data;
}
export const admin = {
  stats: () => api('GET', '/admin/stats'),
  attendanceWeekTrend: () => api('GET', '/admin/attendance-week-trend'),
  classrooms: {
    list: () => api('GET', '/admin/classrooms'),
    create: (body) => api('POST', '/admin/classrooms', body),
    update: (roomId, body) => api('PUT', `/admin/classrooms/${roomId}`, body),
    delete: (roomId) =>
      fetch(`${API_BASE}/admin/classrooms/${roomId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete failed');
      }),
  },
  periods: {
    list: () => api('GET', '/admin/periods'),
    create: (body) => api('POST', '/admin/periods', body),
    update: (periodId, body) => api('PUT', `/admin/periods/${periodId}`, body),
    delete: (periodId) =>
      fetch(`${API_BASE}/admin/periods/${periodId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete failed');
      }),
    sync: (items) => api('PUT', '/admin/periods-sync', items),
  },
  subjects: {
    list: () => api('GET', '/admin/subjects'),
    create: (body) => api('POST', '/admin/subjects', body),
    update: (code, body) => api('PUT', `/admin/subjects/${code}`, body),
    delete: (code) =>
      fetch(`${API_BASE}/admin/subjects/${code}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete failed');
      }),
  },
  faculty: {
    list: () => api('GET', '/admin/faculty'),
    update: (facultyId, body) => api('PUT', `/admin/faculty/${facultyId}`, body),
    toggle: (facultyId) => api('PATCH', `/admin/faculty/${facultyId}/toggle`),
    delete: (facultyId) =>
      fetch(`${API_BASE}/admin/faculty/${facultyId}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Delete failed');
      }),
  },
};
/* Student auth: /auth/* uses student_token */
export const studentAuth = {
  register: (data) => api('POST', '/auth/register', data, { token: null }),
  login: (email, password) => api('POST', '/auth/login', { email, password }, { token: null }),
  me: () => api('GET', '/auth/me', null, { token: getStudentToken() }),
};

/* Faculty auth: /faculty/auth/* uses faculty_token */
export const facultyAuth = {
  register: (data) => api('POST', '/faculty/auth/register', data, { token: null }),
  login: (email, password) => api('POST', '/faculty/auth/login', { email, password }, { token: null }),
  me: () => api('GET', '/faculty/auth/me', null, { token: getFacultyToken() }),
};

export const classrooms = {
  list: () =>
    api('GET', '/classrooms', null, { token: getFacultyToken() }).then((res) =>
      Array.isArray(res) ? res : res?.data ?? []
    ),
  getCoordinates: (id) =>
    api('GET', `/classrooms/${id}/coordinates`, null, { token: getFacultyToken() }),
};

export const attendance = {
  verifyGeolocation: (classId, latitude, longitude) =>
    api('GET', `/attendance/verify-geolocation?class_id=${classId}&latitude=${latitude}&longitude=${longitude}`),
  /** Time-based: 0-5 min Present, 5-10 min Late, >10 min closed */
  getWindow: (classId) =>
    api('GET', `/attendance/window?class_id=${encodeURIComponent(classId)}`, null, { token: getStudentToken() }),
  mark: (body) =>
    api('POST', '/attendance/mark', body, { token: getStudentToken() }),
  markEntry: (body) => api('POST', '/attendance/entry', body),
  sessionVerify: (attendanceId, faceEmbedding) =>
    api('POST', '/attendance/session/verify', { attendance_id: attendanceId, face_embedding: faceEmbedding }),
  getMyHistory: (studentId) =>
    api('GET', `/attendance/student/${studentId}`, null, { token: getStudentToken() }),
};

export const timetable = {
  getActive: () => api('GET', '/faculty/timetable/active', null, { token: getFacultyToken() }),
  create: (body) => api('POST', '/faculty/timetable/create', body, { token: getFacultyToken() }),
  update: (id, body) => api('PUT', `/faculty/timetable/update/${id}`, body, { token: getFacultyToken() }),
};

export const facultyClasses = {
  list: () => api('GET', '/faculty/classes', null, { token: getFacultyToken() }),
  /** Most recent classes by latest attendance activity */
  recent: (limit = 5) =>
    api('GET', `/faculty/classes/recent?limit=${limit}`, null, { token: getFacultyToken() }),
  getStudents: (classId) => api('GET', `/faculty/classes/${classId}/students`, null, { token: getFacultyToken() }),
  /** Latest session per student: on time / late / absent */
  getStudentsLastSession: (classId) =>
    api('GET', `/faculty/classes/${classId}/students/last-session`, null, {
      token: getFacultyToken(),
    }),
  /** Per-student present / late / absent counts for View Attendance */
  getAttendanceSummary: (classId) =>
    api('GET', `/faculty/classes/${classId}/students/attendance-summary`, null, {
      token: getFacultyToken(),
    }),
  stats: () => api('GET', '/faculty/classes/stats', null, { token: getFacultyToken() }),
};

/** Dashboard charts 1–8 (attendance aggregates) */
export const facultyAnalytics = {
  getDashboard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api('GET', `/faculty/analytics/dashboard${q ? `?${q}` : ''}`, null, { token: getFacultyToken() });
  },
};

export const classes = {
  list: () => api('GET', '/classes'),
  myBatch: () => api('GET', '/classes/my-batch'),
  enroll: (classId) => api('POST', `/classes/${classId}/enroll`),
};

export const notifications = {
  list: () => api('GET', '/notifications', null, { token: getStudentToken() }),
  updatePermission: (enabled) =>
    api('PUT', '/notifications/permission', { enabled }, { token: getStudentToken() }),
  markRead: (id) =>
    api('PATCH', `/notifications/${id}/read`, null, { token: getStudentToken() }),
};
