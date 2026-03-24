// API Configuration
const API_BASE_URL = 'http://localhost:8000';

// State Management
const state = {
    token: localStorage.getItem('faculty_token') || null,
    user: JSON.parse(localStorage.getItem('faculty_user') || 'null'),
    classes: [],
    selectedClass: null,
    attendanceRecords: []
};

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

// New module elements
const addStudentBtn = document.getElementById('addStudentBtn');
const studentSearch = document.getElementById('studentSearch');
const studentsListContainer = document.getElementById('studentsListContainer');
const profileForm = document.getElementById('profileForm');
const securityForm = document.getElementById('securityForm');

// Face recognition elements
const markAttendanceWithFaceBtn = document.getElementById('markAttendanceWithFaceBtn');
const bulkFaceEnrollBtn = document.getElementById('bulkFaceEnrollBtn');
const faceFilter = document.getElementById('faceFilter');
const totalStudentsCount = document.getElementById('totalStudentsCount');
const faceEnrolledCount = document.getElementById('faceEnrolledCount');
const pendingEnrollmentCount = document.getElementById('pendingEnrollmentCount');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    if (state.token) {
        showDashboard();
        loadDashboardData();
    } else {
        showLogin();
    }

    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = item.dataset.view;
            switchView(viewName);
        });
    });

    document.getElementById('refreshBtn').addEventListener('click', loadDashboardData);
    document.getElementById('createClassBtn').addEventListener('click', openCreateClassModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeCreateClassModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeCreateClassModal);
    document.getElementById('createClassForm').addEventListener('submit', handleCreateClass);
    document.getElementById('classFilter').addEventListener('change', handleClassFilterChange);
    document.getElementById('exportBtn').addEventListener('click', exportAttendance);

    // New module event listeners
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', openAddStudentModal);
    }
    if (studentSearch) {
        studentSearch.addEventListener('input', handleStudentSearch);
    }
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
    if (securityForm) {
        securityForm.addEventListener('submit', handlePasswordChange);
    }
    
    // Face recognition event listeners
    if (markAttendanceWithFaceBtn) {
        markAttendanceWithFaceBtn.addEventListener('click', handleMarkAttendanceWithFace);
    }
    if (bulkFaceEnrollBtn) {
        bulkFaceEnrollBtn.addEventListener('click', handleBulkFaceEnrollment);
    }
    if (faceFilter) {
        faceFilter.addEventListener('change', handleFaceFilterChange);
    }
    
    // Overview module event listeners
    const startAttendanceBtn = document.getElementById('startAttendanceBtn');
    const liveClassFilter = document.getElementById('liveClassFilter');
    
    if (startAttendanceBtn) {
        startAttendanceBtn.addEventListener('click', handleStartAttendance);
    }
    if (liveClassFilter) {
        liveClassFilter.addEventListener('change', handleLiveClassFilter);
    }

    // Close modal on overlay click
    document.querySelector('.modal-overlay').addEventListener('click', closeCreateClassModal);
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/faculty/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('Invalid credentials');
        }

        const data = await response.json();
        state.token = data.access_token;
        localStorage.setItem('faculty_token', data.access_token);

        // Get user info
        const userResponse = await fetch(`${API_BASE_URL}/faculty/auth/me`, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });

        if (userResponse.ok) {
            state.user = await userResponse.json();
            localStorage.setItem('faculty_user', JSON.stringify(state.user));
        }

        showDashboard();
        console.log('Called showDashboard, now calling loadDashboardData');
        loadDashboardData();

    } catch (error) {
        showError(error.message);
    }
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('faculty_token');
    localStorage.removeItem('faculty_user');
    showLogin();
}

function showLogin() {
    loginScreen.classList.add('active');
    dashboardScreen.classList.remove('active');
}

function showDashboard() {
    console.log('showDashboard called');
    console.log('loginScreen:', loginScreen);
    console.log('dashboardScreen:', dashboardScreen);
    
    if (loginScreen) {
        loginScreen.classList.remove('active');
        console.log('Removed active from loginScreen');
    }
    
    if (dashboardScreen) {
        dashboardScreen.classList.add('active');
        console.log('Added active to dashboardScreen');
    }

    if (state.user) {
        const userNameElement = document.getElementById('userName');
        const userInitialsElement = document.getElementById('userInitials');
        
        if (userNameElement) {
            userNameElement.textContent = state.user.name;
            console.log('Set userName to:', state.user.name);
        }
        
        if (userInitialsElement) {
            userInitialsElement.textContent = state.user.name.charAt(0).toUpperCase();
            console.log('Set userInitials to:', state.user.name.charAt(0).toUpperCase());
        }
    }
}

function showError(message) {
    loginError.textContent = message;
    loginError.classList.add('show');
    setTimeout(() => {
        loginError.classList.remove('show');
    }, 5000);
}

// Navigation
function switchView(viewName) {
    // Update nav items
    navItems.forEach(item => {
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update views
    views.forEach(view => {
        view.classList.remove('active');
    });

    const targetView = document.getElementById(`${viewName}View`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // Update page title
    const titles = {
        overview: { title: 'Overview', subtitle: "Welcome back! Here's your attendance overview" },
        classes: { title: 'Classes', subtitle: 'Manage your classes and schedules' },
        attendance: { title: 'Attendance', subtitle: 'View and analyze attendance records' },
        analytics: { title: 'Analytics', subtitle: 'Insights and trends' }
    };

    const pageInfo = titles[viewName] || titles.overview;
    document.getElementById('pageTitle').textContent = pageInfo.title;
    document.getElementById('pageSubtitle').textContent = pageInfo.subtitle;

    // Load view-specific data
    if (viewName === 'classes') {
        loadClasses();
    } else if (viewName === 'attendance') {
        loadClassesForFilter();
    } else if (viewName === 'analytics') {
        loadAnalytics();
    }
}

// Dashboard Data
async function loadDashboardData() {
    await loadClasses();
    await loadOverviewStats();
    await loadOverviewStats();
}

async function loadClasses() {
    try {
        const response = await fetch(`${API_BASE_URL}/classes`, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load classes');

        state.classes = await response.json();
        renderRecentClasses();
        renderClassesList();

    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

async function loadOverviewStats() {
    try {
        // Calculate stats from classes
        const totalClasses = state.classes.length;
        const activeClasses = state.classes.filter(c => c.is_active).length;

        // Get attendance data for all classes
        let totalAttendance = 0;
        let totalStudents = new Set();
        let highConfidenceCount = 0;
        let needsReviewCount = 0;

        for (const classItem of state.classes) {
            try {
                const response = await fetch(`${API_BASE_URL}/attendance/class/${classItem.id}`, {
                    headers: {
                        'Authorization': `Bearer ${state.token}`
                    }
                });

                if (response.ok) {
                    const records = await response.json();
                    totalAttendance += records.filter(r => r.status === 'PRESENT').length;
                    records.forEach(r => totalStudents.add(r.student_id));

                    highConfidenceCount += records.filter(r => r.confidence_score >= 75).length;
                    needsReviewCount += records.filter(r => r.confidence_score < 60).length;
                }
            } catch (err) {
                console.error('Error loading attendance for class:', err);
            }
        }

        // Update stats
        document.getElementById('totalClasses').textContent = totalClasses;
        document.getElementById('totalStudents').textContent = totalStudents.size;
        document.getElementById('avgAttendance').textContent = totalClasses > 0
            ? Math.round((totalAttendance / (totalStudents.size * totalClasses)) * 100) + '%'
            : '0%';
        document.getElementById('activeClasses').textContent = activeClasses;
        document.getElementById('todayClasses').textContent = activeClasses;
        document.getElementById('highConfidence').textContent = highConfidenceCount;
        document.getElementById('needsReview').textContent = needsReviewCount;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function renderRecentClasses() {
    const container = document.getElementById('recentClassesList');

    if (state.classes.length === 0) {
        container.innerHTML = '<p class="empty-state">No classes found. Create your first class!</p>';
        return;
    }

    const recentClasses = state.classes.slice(0, 5);

    container.innerHTML = recentClasses.map(classItem => `
        <div class="list-item">
            <div class="list-item-header">
                <div class="list-item-title">${classItem.subject_name}</div>
                <span class="list-item-badge ${classItem.is_active ? 'badge-active' : 'badge-inactive'}">
                    ${classItem.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div class="list-item-meta">
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                    </svg>
                    ${classItem.class_code}
                </span>
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    ${classItem.faculty_name}
                </span>
                <span class="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    ${classItem.radius}m radius
                </span>
            </div>
        </div>
    `).join('');
}

function renderClassesList() {
    const container = document.getElementById('classesListContainer');

    if (state.classes.length === 0) {
        container.innerHTML = '<p class="empty-state">No classes found. Create your first class!</p>';
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Class Code</th>
                        <th>Subject</th>
                        <th>Faculty</th>
                        <th>Schedule</th>
                        <th>Geofence</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.classes.map(classItem => `
                        <tr>
                            <td><strong>${classItem.class_code}</strong></td>
                            <td>${classItem.subject_name}</td>
                            <td>${classItem.faculty_name}</td>
                            <td>
                                <div style="font-size: 0.875rem;">
                                    ${formatDateTime(classItem.start_time)}<br>
                                    to ${formatDateTime(classItem.end_time)}
                                </div>
                            </td>
                            <td>
                                <div style="font-size: 0.875rem;">
                                    ${classItem.latitude.toFixed(4)}, ${classItem.longitude.toFixed(4)}<br>
                                    Radius: ${classItem.radius}m
                                </div>
                            </td>
                            <td>
                                <span class="status-badge ${classItem.is_active ? 'status-present' : 'status-absent'}">
                                    <span class="status-dot"></span>
                                    ${classItem.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Class Management
function openCreateClassModal() {
    document.getElementById('createClassModal').classList.add('active');
}

function closeCreateClassModal() {
    document.getElementById('createClassModal').classList.remove('active');
    document.getElementById('createClassForm').reset();
}

async function handleCreateClass(e) {
    e.preventDefault();

    const formData = {
        class_code: document.getElementById('classCode').value,
        subject_name: document.getElementById('subjectName').value,
        faculty_name: document.getElementById('facultyName').value,
        start_time: document.getElementById('startTime').value,
        end_time: document.getElementById('endTime').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        radius: parseInt(document.getElementById('radius').value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/classes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create class');
        }

        closeCreateClassModal();
        await loadClasses();
        switchView('classes');

    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Attendance
async function loadClassesForFilter() {
    const select = document.getElementById('classFilter');
    select.innerHTML = '<option value="">Select a class...</option>' +
        state.classes.map(c => `<option value="${c.id}">${c.class_code} - ${c.subject_name}</option>`).join('');
}

async function handleClassFilterChange(e) {
    const classId = e.target.value;

    if (!classId) {
        document.getElementById('attendanceTableContainer').innerHTML =
            '<p class="empty-state">Select a class to view attendance records</p>';
        return;
    }

    state.selectedClass = classId;
    await loadAttendanceRecords(classId);
}

async function loadAttendanceRecords(classId) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/class/${classId}`, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load attendance');

        state.attendanceRecords = await response.json();
        renderAttendanceTable();

    } catch (error) {
        console.error('Error loading attendance:', error);
        document.getElementById('attendanceTableContainer').innerHTML =
            '<p class="empty-state">Error loading attendance records</p>';
    }
}

function renderAttendanceTable() {
    const container = document.getElementById('attendanceTableContainer');

    if (state.attendanceRecords.length === 0) {
        container.innerHTML = '<p class="empty-state">No attendance records found for this class</p>';
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Student ID</th>
                        <th>Entry Time</th>
                        <th>Exit Time</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Confidence</th>
                        <th>Pings</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.attendanceRecords.map(record => `
                        <tr>
                            <td><strong>${record.student_id}</strong></td>
                            <td>${record.entry_time ? formatDateTime(record.entry_time) : '-'}</td>
                            <td>${record.exit_time ? formatDateTime(record.exit_time) : '-'}</td>
                            <td>${record.duration_minutes || 0} min</td>
                            <td>
                                <span class="status-badge status-${record.status.toLowerCase().replace('_', '-')}">
                                    <span class="status-dot"></span>
                                    ${record.status.replace('_', ' ')}
                                </span>
                            </td>
                            <td>${renderConfidenceScore(record.confidence_score || 0)}</td>
                            <td>
                                <div style="font-size: 0.875rem;">
                                    ${record.total_pings || 0} total<br>
                                    <span style="color: var(--success-color);">${record.inside_geofence_pings || 0} inside</span> / 
                                    <span style="color: var(--danger-color);">${record.outside_geofence_pings || 0} outside</span>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderConfidenceScore(score) {
    let className = 'confidence-low';
    if (score >= 75) className = 'confidence-high';
    else if (score >= 60) className = 'confidence-medium';

    return `
        <div class="confidence-score">
            <div class="confidence-bar">
                <div class="confidence-fill ${className}" style="width: ${score}%"></div>
            </div>
            <span class="confidence-text">${score}%</span>
        </div>
    `;
}

// Analytics
async function loadAnalytics() {
    const container = document.getElementById('confidenceDistribution');

    // Calculate confidence distribution
    const distribution = {
        veryHigh: 0,
        high: 0,
        medium: 0,
        low: 0,
        veryLow: 0
    };

    for (const classItem of state.classes) {
        try {
            const response = await fetch(`${API_BASE_URL}/attendance/class/${classItem.id}`, {
                headers: {
                    'Authorization': `Bearer ${state.token}`
                }
            });

            if (response.ok) {
                const records = await response.json();
                records.forEach(record => {
                    const score = record.confidence_score || 0;
                    if (score >= 90) distribution.veryHigh++;
                    else if (score >= 75) distribution.high++;
                    else if (score >= 60) distribution.medium++;
                    else if (score >= 40) distribution.low++;
                    else distribution.veryLow++;
                });
            }
        } catch (err) {
            console.error('Error loading analytics:', err);
        }
    }

    container.innerHTML = `
        <div class="quick-stats">
            <div class="quick-stat-item">
                <span class="quick-stat-label">Very High (90-100%)</span>
                <span class="quick-stat-value" style="color: var(--success-color);">${distribution.veryHigh}</span>
            </div>
            <div class="quick-stat-item">
                <span class="quick-stat-label">High (75-89%)</span>
                <span class="quick-stat-value" style="color: #34d399;">${distribution.high}</span>
            </div>
            <div class="quick-stat-item">
                <span class="quick-stat-label">Medium (60-74%)</span>
                <span class="quick-stat-value" style="color: var(--warning-color);">${distribution.medium}</span>
            </div>
            <div class="quick-stat-item">
                <span class="quick-stat-label">Low (40-59%)</span>
                <span class="quick-stat-value" style="color: #fb923c;">${distribution.low}</span>
            </div>
            <div class="quick-stat-item">
                <span class="quick-stat-label">Very Low (0-39%)</span>
                <span class="quick-stat-value" style="color: var(--danger-color);">${distribution.veryLow}</span>
            </div>
        </div>
    `;
}

// Export
function exportAttendance() {
    if (state.attendanceRecords.length === 0) {
        alert('No attendance records to export');
        return;
    }

    const csv = convertToCSV(state.attendanceRecords);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${state.selectedClass}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function convertToCSV(data) {
    const headers = ['Student ID', 'Entry Time', 'Exit Time', 'Duration (min)', 'Status', 'Confidence Score', 'Total Pings', 'Inside Pings', 'Outside Pings'];
    const rows = data.map(record => [
        record.student_id,
        record.entry_time || '',
        record.exit_time || '',
        record.duration_minutes || 0,
        record.status,
        record.confidence_score || 0,
        record.total_pings || 0,
        record.inside_geofence_pings || 0,
        record.outside_geofence_pings || 0
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Student Management Functions
function openAddStudentModal() {
    // Implementation for adding student modal
    console.log('Open add student modal');
}

function handleStudentSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    // Filter students based on search term
    console.log('Searching students:', searchTerm);
}

// Profile Functions
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('profileName').value,
        department: document.getElementById('profileDepartment').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('Profile updated successfully!');
            // Update local state
            state.user = { ...state.user, ...formData };
            localStorage.setItem('faculty_user', JSON.stringify(state.user));
        } else {
            const error = await response.json();
            alert('Failed to update profile: ' + (error.detail || 'Unknown error'));
        }
    } catch (error) {
        alert('Error updating profile: ' + error.message);
    }
}

async function handlePasswordChange(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }

    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        if (response.ok) {
            alert('Password changed successfully!');
            // Clear form
            document.getElementById('securityForm').reset();
        } else {
            const error = await response.json();
            alert('Failed to change password: ' + (error.detail || 'Unknown error'));
        }
    } catch (error) {
        alert('Error changing password: ' + error.message);
    }
}

// Attendance Session Functions
async function handleStartAttendance() {
    const selectedClassId = liveClassFilter.value;
    
    if (!selectedClassId) {
        showError('Please select a class to start attendance');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                class_id: selectedClassId
            })
        });

        if (response.ok) {
            // Update UI to show active session
            document.getElementById('liveSessionStatus').textContent = 'Active';
            document.getElementById('liveSessionStatus').className = 'quick-stat-value success';
            document.getElementById('cameraStatus').textContent = 'Recording';
            
            alert('Attendance session started successfully!');
            
            // Open attendance view
            switchView('attendance');
        } else {
            const error = await response.json();
            showError('Failed to start attendance: ' + (error.detail || 'Unknown error'));
        }
    } catch (error) {
        showError('Error starting attendance: ' + error.message);
    }
}

function handleLiveClassFilter(e) {
    const selectedClassId = e.target.value;
    console.log('Selected class for attendance:', selectedClassId);
    
    // Update class filter in attendance view
    const attendanceClassFilter = document.getElementById('classFilter');
    if (attendanceClassFilter) {
        attendanceClassFilter.value = selectedClassId;
    }
}

// Enhanced Overview Data Loading
async function loadOverviewStats() {
    try {
        // Update live session status
        document.getElementById('liveSessionStatus').textContent = 'Checking...';
        document.getElementById('cameraStatus').textContent = 'Ready';

    } catch (error) {
        console.error('Error loading overview stats:', error);
    }
}

// Face Recognition Functions
async function handleMarkAttendanceWithFace() {
    const classFilter = document.getElementById('classFilter');
    const selectedClassId = classFilter.value;
    
    if (!selectedClassId) {
        showError('Please select a class first');
        return;
    }
    
    try {
        // Get current location for geofence validation
        const position = await getCurrentPosition();
        
        // Show face recognition modal
        showWebcamModal(
            'Mark Attendance - Face Verification',
            async (imageData) => {
                try {
                    const formData = new FormData();
                    formData.append('image', imageData);
                    formData.append('class_id', selectedClassId);
                    formData.append('latitude', position.latitude);
                    formData.append('longitude', position.longitude);
                    
                    const response = await fetch(`${API_BASE_URL}/attendance/entry-with-face`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${state.token}`
                        },
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        showSuccess('Attendance marked successfully with face recognition!');
                        loadAttendanceData();
                    } else {
                        showError(result.detail || 'Face verification failed');
                    }
                } catch (error) {
                    showError('Error marking attendance: ' + error.message);
                }
            },
            () => {
                console.log('Face verification cancelled');
            }
        );
    } catch (error) {
        showError('Error getting location: ' + error.message);
    }
}

async function handleBulkFaceEnrollment() {
    try {
        // Get all students without face enrollment
        const response = await fetch(`${API_BASE_URL}/students`, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        const students = await response.json();
        const unenrolledStudents = students.filter(s => !s.face_enrolled);
        
        if (unenrolledStudents.length === 0) {
            showSuccess('All students are already enrolled for face recognition!');
            return;
        }
        
        // Show bulk enrollment modal
        showBulkEnrollmentModal(unenrolledStudents);
        
    } catch (error) {
        showError('Error loading students: ' + error.message);
    }
}

function handleFaceFilterChange(e) {
    const filterValue = e.target.value;
    loadStudentsData(filterValue);
}

function showBulkEnrollmentModal(students) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Bulk Face Enrollment</h3>
                <button class="modal-close" onclick="closeBulkEnrollmentModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="bulk-enrollment-progress">
                    <h4>Enrolling ${students.length} students...</h4>
                    <div id="enrollmentProgress"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Start enrollment process
    enrollStudentsSequentially(students, 0);
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeBulkEnrollmentModal();
        }
    };
}

function closeBulkEnrollmentModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

async function enrollStudentsSequentially(students, index) {
    if (index >= students.length) {
        showSuccess('Bulk face enrollment completed!');
        closeBulkEnrollmentModal();
        loadStudentsData();
        return;
    }
    
    const student = students[index];
    const progressDiv = document.getElementById('enrollmentProgress');
    
    // Update progress
    progressDiv.innerHTML += `
        <div class="progress-item">
            <span>${student.name}</span>
            <span id="progress-${student.id}">Starting...</span>
            <div class="progress-bar">
                <div class="progress-fill" id="bar-${student.id}" style="width: 0%"></div>
            </div>
        </div>
    `;
    
    try {
        // Show individual enrollment modal
        await new Promise((resolve, reject) => {
            showWebcamModal(
                `Enroll Face - ${student.name}`,
                async (imageData) => {
                    try {
                        const formData = new FormData();
                        formData.append('image', imageData);
                        formData.append('student_id', student.id);
                        
                        const response = await fetch(`${API_BASE_URL}/face/register`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${state.token}`
                            },
                            body: formData
                        });
                        
                        const result = await response.json();
                        
                        if (response.ok) {
                            document.getElementById(`progress-${student.id}`).textContent = '✅ Enrolled';
                            document.getElementById(`bar-${student.id}`).style.width = '100%';
                            resolve();
                        } else {
                            document.getElementById(`progress-${student.id}`).textContent = '❌ Failed';
                            document.getElementById(`bar-${student.id}`).style.width = '100%';
                            reject(new Error(result.detail || 'Enrollment failed'));
                        }
                    } catch (error) {
                        document.getElementById(`progress-${student.id}`).textContent = '❌ Error';
                        document.getElementById(`bar-${student.id}`).style.width = '100%';
                        reject(error);
                    }
                },
                () => {
                    document.getElementById(`progress-${student.id}`).textContent = '⏭️ Skipped';
                    document.getElementById(`bar-${student.id}`).style.width = '100%';
                    resolve(); // Continue with next student
                }
            );
        });
        
        // Continue with next student
        await enrollStudentsSequentially(students, index + 1);
        
    } catch (error) {
        console.error(`Enrollment failed for ${student.name}:`, error);
        // Continue with next student even if current fails
        await enrollStudentsSequentially(students, index + 1);
    }
}

async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                reject(new Error('Unable to get location: ' + error.message));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

async function loadStudentsData(faceFilter = '') {
    try {
        let url = `${API_BASE_URL}/students`;
        if (faceFilter) {
            url += `?face_enrolled=${faceFilter === 'enrolled'}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        const students = await response.json();
        
        // Update student list
        displayStudents(students);
        
        // Update statistics
        updateFaceRecognitionStats(students);
        
    } catch (error) {
        console.error('Error loading students:', error);
        if (studentsListContainer) {
            studentsListContainer.innerHTML = '<div class="error">Failed to load students</div>';
        }
    }
}

function displayStudents(students) {
    if (!studentsListContainer) return;
    
    if (students.length === 0) {
        studentsListContainer.innerHTML = '<div class="empty-state">No students found</div>';
        return;
    }
    
    const studentsHTML = students.map(student => `
        <div class="list-item">
            <div class="item-info">
                <div class="item-title">${student.name}</div>
                <div class="item-subtitle">${student.student_id} - ${student.email}</div>
                <div class="item-meta">
                    <span class="face-enrollment-status ${student.face_enrolled ? 'enrolled' : 'not-enrolled'}">
                        ${student.face_enrolled ? '✅ Face Enrolled' : '❌ Face Not Enrolled'}
                    </span>
                </div>
            </div>
            <div class="item-actions">
                ${!student.face_enrolled ? `
                    <button class="btn-secondary btn-sm" onclick="enrollSingleStudentFace('${student.id}', '${student.name}')">
                        Enroll Face
                    </button>
                ` : `
                    <button class="btn-secondary btn-sm" onclick="removeStudentFaceEnrollment('${student.id}', '${student.name}')">
                        Remove Face
                    </button>
                `}
            </div>
        </div>
    `).join('');
    
    studentsListContainer.innerHTML = studentsHTML;
}

function updateFaceRecognitionStats(students) {
    if (totalStudentsCount) {
        totalStudentsCount.textContent = students.length;
    }
    
    const enrolledCount = students.filter(s => s.face_enrolled).length;
    if (faceEnrolledCount) {
        faceEnrolledCount.textContent = enrolledCount;
    }
    
    const pendingCount = students.filter(s => !s.face_enrolled).length;
    if (pendingEnrollmentCount) {
        pendingEnrollmentCount.textContent = pendingCount;
    }
}

async function enrollSingleStudentFace(studentId, studentName) {
    try {
        showWebcamModal(
            `Enroll Face - ${studentName}`,
            async (imageData) => {
                const formData = new FormData();
                formData.append('image', imageData);
                formData.append('student_id', studentId);
                
                const response = await fetch(`${API_BASE_URL}/face/register`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${state.token}`
                    },
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showSuccess(`Face enrolled successfully for ${studentName}!`);
                    loadStudentsData();
                } else {
                    showError(result.detail || 'Face enrollment failed');
                }
            },
            () => {
                console.log('Face enrollment cancelled');
            }
        );
    } catch (error) {
        showError('Error enrolling face: ' + error.message);
    }
}

async function removeStudentFaceEnrollment(studentId, studentName) {
    if (!confirm(`Are you sure you want to remove face enrollment for ${studentName}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/face/remove/${studentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (response.ok) {
            showSuccess(`Face enrollment removed for ${studentName}!`);
            loadStudentsData();
        } else {
            const error = await response.json();
            showError(error.detail || 'Failed to remove face enrollment');
        }
    } catch (error) {
        showError('Error removing face enrollment: ' + error.message);
    }
}

// Utilities
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
