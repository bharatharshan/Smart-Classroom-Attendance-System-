// API Configuration
const API_BASE_URL = 'http://localhost:8000';

// State Management
const state = {
    token: localStorage.getItem('student_token') || null,
    user: (() => { try { return JSON.parse(localStorage.getItem('student_user') || 'null'); } catch { return null; } })(),
    activeAttendance: (() => { try { return JSON.parse(localStorage.getItem('active_attendance') || 'null'); } catch { return null; } })(),
    webcamStream: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    if (state.token && state.user) {
        showDashboard();
        loadBatchClasses();
    } else {
        showLogin();
    }
    setupEventListeners();
});

// ===== AUTH =====
function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registrationForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (regForm) regForm.addEventListener('submit', handleRegistration);

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Webcam modal close
    const webcamClose = document.getElementById('webcamClose');
    if (webcamClose) webcamClose.addEventListener('click', closeWebcam);

    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.addEventListener('click', captureAndSubmit);
}

function showLogin() {
    document.getElementById('loginScreen')?.classList.add('active');
    document.getElementById('registrationScreen')?.classList.remove('active');
    document.getElementById('dashboardScreen')?.classList.remove('active');
}

function showRegistration() {
    document.getElementById('loginScreen')?.classList.remove('active');
    document.getElementById('registrationScreen')?.classList.add('active');
    document.getElementById('dashboardScreen')?.classList.remove('active');
}

function showDashboard() {
    document.getElementById('loginScreen')?.classList.remove('active');
    document.getElementById('registrationScreen')?.classList.remove('active');
    document.getElementById('dashboardScreen')?.classList.add('active');
    updateUserInfo();
}

function updateUserInfo() {
    if (!state.user) return;
    const el = id => document.getElementById(id);
    if (el('userName')) el('userName').textContent = state.user.name || '';
    if (el('userRoll')) el('userRoll').textContent = state.user.student_id || '';
    if (el('userInitials')) el('userInitials').textContent = (state.user.name || 'S').charAt(0).toUpperCase();
    if (el('userBatch')) el('userBatch').textContent = state.user.year || '';
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('[name=email]').value;
    const password = form.querySelector('[name=password]').value;
    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            state.token = data.access_token;
            const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            state.user = meRes.ok ? await meRes.json() : null;
            localStorage.setItem('student_token', state.token);
            localStorage.setItem('student_user', JSON.stringify(state.user));
            showDashboard();
            loadBatchClasses();
        } else {
            showMsg('loginError', data.detail || 'Login failed', 'error');
        }
    } catch { showMsg('loginError', 'Network error', 'error'); }
}

async function handleRegistration(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
        student_id: form.querySelector('[name=student_id]').value,
        name: form.querySelector('[name=name]').value,
        email: form.querySelector('[name=email]').value,
        password: form.querySelector('[name=password]').value,
        department: form.querySelector('[name=department]')?.value,
        year: form.querySelector('[name=year]').value
    };
    try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const resp = await res.json();
        if (res.ok) {
            showMsg('regSuccess', 'Registered! Please log in.', 'success');
            setTimeout(showLogin, 2000);
        } else {
            showMsg('regError', resp.detail || 'Registration failed', 'error');
        }
    } catch { showMsg('regError', 'Network error', 'error'); }
}

function handleLogout() {
    state.token = null; state.user = null; state.activeAttendance = null;
    localStorage.clear();
    window.location.href = 'student-login.html';
}

// ===== NAVIGATION =====
function switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === viewName));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}View`)?.classList.add('active');
    if (viewName === 'classes') loadBatchClasses();
    if (viewName === 'history') loadHistory();
}

// ===== BATCH CLASSES (core feature) =====
async function loadBatchClasses() {
    const container = document.getElementById('classesListContainer');
    if (!container) return;
    container.innerHTML = '<div class="loading">Loading your classes...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/classes/my-batch`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error('Failed to load classes');
        const classes = await res.json();
        renderClasses(classes);
    } catch (e) {
        container.innerHTML = `<p class="empty-state">Error: ${e.message}</p>`;
    }
}

function renderClasses(classes) {
    const container = document.getElementById('classesListContainer');
    if (!container) return;
    if (!classes.length) {
        container.innerHTML = '<p class="empty-state">No classes available for your batch.</p>';
        return;
    }
    container.innerHTML = classes.map(cls => {
        const enrolled = cls.enrolled;
        const attended = cls.attendance_marked;
        let actionBtn = '';
        if (attended) {
            actionBtn = `<div class="btn-present">✅ Attendance Marked</div>`;
        } else if (enrolled) {
            actionBtn = `<button class="btn-primary btn-block" onclick="openWebcam('${cls.id}','${cls.subject_name}')">📷 Mark Attendance</button>`;
        } else {
            actionBtn = `<button class="btn-secondary btn-block" onclick="enrollInClass('${cls.id}')">🔔 Join Class</button>`;
        }
        return `
        <div class="class-card" id="class-${cls.id}">
            <div class="class-header">
                <h3>${cls.subject_name}</h3>
                <span class="class-code">${cls.batch || ''}</span>
            </div>
            <div class="class-details">
                <p><strong>Faculty:</strong> ${cls.faculty_name}</p>
                <p><strong>Time:</strong> ${formatTime(cls.start_time)} – ${formatTime(cls.end_time)}</p>
                <p><strong>Code:</strong> ${cls.class_code}</p>
                ${enrolled ? `<p style="color:#20b1ab;font-weight:600;">👥 ${cls.enrolled_count} enrolled</p>` : ''}
            </div>
            <div style="margin-top:12px;">${actionBtn}</div>
        </div>`;
    }).join('');
}

async function enrollInClass(classId) {
    try {
        const res = await fetch(`${API_BASE_URL}/classes/${classId}/enroll`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}`, 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            showToastMsg('Joined class! You can now mark attendance.');
            loadBatchClasses(); // refresh cards
        } else {
            const err = await res.json();
            showToastMsg(err.detail || 'Failed to join', 'error');
        }
    } catch { showToastMsg('Network error', 'error'); }
}

// ===== WEBCAM ATTENDANCE =====
let currentClassId = null;

function openWebcam(classId, subjectName) {
    currentClassId = classId;
    const modal = document.getElementById('webcamModal');
    if (!modal) return;
    document.getElementById('webcamSubject').textContent = subjectName || '';
    document.getElementById('webcamStatus').textContent = '';
    modal.style.display = 'flex';
    startWebcam();
}

function closeWebcam() {
    stopWebcam();
    const modal = document.getElementById('webcamModal');
    if (modal) modal.style.display = 'none';
    currentClassId = null;
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        state.webcamStream = stream;
        const video = document.getElementById('webcamFeed');
        if (video) { video.srcObject = stream; video.play(); }
    } catch (e) {
        document.getElementById('webcamStatus').textContent = '⚠️ Camera not available: ' + e.message;
    }
}

function stopWebcam() {
    if (state.webcamStream) {
        state.webcamStream.getTracks().forEach(t => t.stop());
        state.webcamStream = null;
    }
}

async function captureAndSubmit() {
    const statusEl = document.getElementById('webcamStatus');
    const captureBtn = document.getElementById('captureBtn');
    statusEl.textContent = 'Detecting face...';
    statusEl.style.color = '';
    captureBtn.disabled = true;

    const video = document.getElementById('webcamFeed');
    let faceEmbedding = null;
    if (typeof FaceEmbedding !== 'undefined') {
        try {
            faceEmbedding = await FaceEmbedding.getFaceDescriptorFromVideo(video);
        } catch (e) {
            statusEl.textContent = 'Face detection error: ' + e.message;
            statusEl.style.color = '#ef4444';
            captureBtn.disabled = false;
            return;
        }
    }
    if (!faceEmbedding || faceEmbedding.length < 16) {
        statusEl.textContent = 'No face detected. Please look at the camera and try again.';
        statusEl.style.color = '#ef4444';
        captureBtn.disabled = false;
        return;
    }

    statusEl.textContent = 'Getting location...';
    captureBtn.disabled = true;

    // Capture frame from webcam (kept for any future use)
    const canvas = document.getElementById('captureCanvas');
    if (video && canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
    }

    try {
        // Get GPS
        const position = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        );
        const { latitude, longitude } = position.coords;
        statusEl.textContent = 'Verifying face & marking attendance...';

        const body = {
            class_id: currentClassId,
            student_id: state.user.id,
            latitude,
            longitude
        };
        if (faceEmbedding && faceEmbedding.length >= 16) {
            body.face_embedding = faceEmbedding;
        }

        const res = await fetch(`${API_BASE_URL}/attendance/entry`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            statusEl.style.color = '#10b981';
            statusEl.textContent = '✅ Attendance marked successfully!';
            stopWebcam();
            setTimeout(() => {
                closeWebcam();
                loadBatchClasses();
            }, 1800);
        } else {
            const err = await res.json();
            const detail = typeof err.detail === 'string' ? err.detail : (err.detail && err.detail[0] ? err.detail[0].msg : 'Failed');
            statusEl.style.color = '#ef4444';
            if (detail.toLowerCase().includes('face') && (res.status === 403 || res.status === 400)) {
                statusEl.textContent = '❌ ' + (detail.includes('enrolled') ? 'Please register your face first (re-register or add face in profile).' : detail);
            } else {
                statusEl.textContent = '❌ ' + detail;
            }
        }
    } catch (e) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = '❌ ' + e.message;
    } finally {
        captureBtn.disabled = false;
    }
}

// ===== HISTORY =====
async function loadHistory() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    container.innerHTML = '<div class="loading">Loading history...</div>';
    try {
        const res = await fetch(`${API_BASE_URL}/attendance/student/${state.user.id}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        if (!res.ok) throw new Error('Failed to load history');
        const records = await res.json();
        if (!records.length) { container.innerHTML = '<p class="empty-state">No attendance history found.</p>'; return; }
        records.sort((a, b) => new Date(b.entry_time) - new Date(a.entry_time));
        container.innerHTML = records.map(r => `
            <div class="list-item">
                <div class="list-item-header">
                    <div class="list-item-title">${new Date(r.entry_time).toLocaleDateString()}</div>
                    <span class="list-item-badge status-${r.status.toLowerCase().replace('_', '-')}">${r.status.replace('_', ' ')}</span>
                </div>
                <div class="list-item-meta">
                    <span class="meta-item">Time: ${formatTime(r.entry_time)} - ${r.exit_time ? formatTime(r.exit_time) : '...'}</span>
                    <span class="meta-item">Duration: ${r.duration_minutes || 0} min</span>
                </div>
            </div>`).join('');
    } catch (e) { container.innerHTML = `<p class="empty-state">Error: ${e.message}</p>`; }
}

// ===== HELPERS =====
function formatTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function showToastMsg(msg, type = 'success') {
    const toast = document.getElementById('studentToast');
    if (!toast) { alert(msg); return; }
    toast.textContent = msg;
    toast.className = `student-toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showMsg(elId, msg, type) {
    const el = document.getElementById(elId);
    if (el) { el.textContent = msg; el.style.color = type === 'error' ? '#ef4444' : '#10b981'; }
}
