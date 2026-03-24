# Faculty Dashboard - Smart Classroom Attendance System

A modern, responsive web dashboard for faculty members to manage classes and monitor student attendance.

## 🎨 Features

### ✅ Authentication
- Secure login with JWT tokens
- Session persistence with localStorage
- User profile display

### 📚 Class Management
- View all classes with details
- Create new classes with geofence settings
- Real-time class status (Active/Inactive)
- Geofence configuration (latitude, longitude, radius)

### 📊 Attendance Tracking
- View attendance records by class
- Filter by class selection
- Detailed attendance metrics:
  - Entry/Exit times
  - Duration calculation
  - Attendance status (Present/Absent/In Progress)
  - Confidence scores with visual indicators
  - Location ping statistics (inside/outside geofence)

### 📈 Analytics Dashboard
- Overview statistics:
  - Total classes and students
  - Average attendance percentage
  - Active classes count
- Confidence score distribution
- Quick stats for review flagging
- Export attendance to CSV

## 🚀 Getting Started

### Prerequisites
- Backend API running on `http://localhost:8000`
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Navigate to frontend directory:**
   ```bash
   cd d:/Final-Year/frontend
   ```

2. **Open the dashboard:**
   - Simply open `faculty-dashboard.html` in your web browser
   - Or use a local server (recommended):
     ```bash
     # Using Python
     python -m http.server 8080
     
     # Using Node.js
     npx http-server -p 8080
     ```
   - Then visit: `http://localhost:8080/faculty-dashboard.html`

### Login Credentials

Use your existing student credentials from the backend:
- **Email:** Your registered email
- **Password:** Your password

> **Note:** Currently, the system uses student authentication. In production, implement separate faculty authentication.

## 📁 File Structure

```
frontend/
├── faculty-dashboard.html   # Main HTML structure
├── styles.css              # Modern dark theme CSS
├── app.js                  # JavaScript application logic
└── README.md              # This file
```

## 🎨 Design Features

### Modern Dark Theme
- Glassmorphism effects
- Smooth animations and transitions
- Gradient accents (purple/blue theme)
- Responsive design for all screen sizes

### Visual Elements
- Interactive stat cards with hover effects
- Color-coded status badges
- Confidence score progress bars
- Animated floating backgrounds
- Clean data tables

### User Experience
- Intuitive navigation sidebar
- Real-time data refresh
- Modal dialogs for actions
- Loading states and empty states
- Error handling with user feedback

## 🔧 Configuration

### API Endpoint
Edit `app.js` to change the API base URL:
```javascript
const API_BASE_URL = 'http://localhost:8000';
```

### Customization
- **Colors:** Modify CSS variables in `styles.css` (`:root` section)
- **Fonts:** Change Google Fonts import in HTML `<head>`
- **Features:** Extend functionality in `app.js`

## 📊 Dashboard Views

### 1. Overview
- Quick statistics cards
- Recent classes list
- Quick stats summary

### 2. Classes
- Complete class list with details
- Create new class button
- Class schedule and geofence info

### 3. Attendance
- Class filter dropdown
- Detailed attendance table
- Export to CSV functionality
- Confidence scores and ping statistics

### 4. Analytics
- Attendance trends (placeholder)
- Confidence score distribution
- Review flagging metrics

## 🔐 Security

- JWT token authentication
- Secure localStorage for session
- CORS-enabled API requests
- Input validation on forms

## 📱 Responsive Design

The dashboard is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px - 1920px)
- Tablet (768px - 1024px)
- Mobile (320px - 768px)

## 🛠️ API Integration

The dashboard integrates with the following backend endpoints:

### Authentication
- `POST /auth/login` - Login
- `GET /auth/me` - Get user info

### Classes
- `GET /classes` - List all classes
- `POST /classes` - Create new class
- `GET /classes/{id}` - Get class details

### Attendance
- `GET /attendance/class/{class_id}` - Get class attendance
- `GET /attendance/student/{student_id}` - Get student attendance

## 🎯 Usage Guide

### Creating a Class

1. Click **"Create Class"** button in Classes view
2. Fill in the form:
   - **Class Code:** e.g., CS101
   - **Subject Name:** e.g., Data Structures
   - **Faculty Name:** Your name
   - **Start/End Time:** Class schedule
   - **Geofence:** Latitude, Longitude, Radius (meters)
3. Click **"Create Class"**

### Viewing Attendance

1. Go to **Attendance** view
2. Select a class from dropdown
3. View detailed attendance records
4. Click **"Export"** to download CSV

### Understanding Confidence Scores

- **90-100% (Very High):** Green - Highly reliable attendance
- **75-89% (High):** Light Green - Reliable attendance
- **60-74% (Medium):** Yellow - Acceptable with minor concerns
- **40-59% (Low):** Orange - Needs review
- **0-39% (Very Low):** Red - Requires manual verification

## 🔄 Data Refresh

- Click the **Refresh** button in the top bar to reload data
- Data auto-loads when switching views
- Real-time updates on class creation

## 📤 Export Features

Export attendance records to CSV with:
- Student IDs
- Entry/Exit times
- Duration
- Status
- Confidence scores
- Ping statistics

## 🐛 Troubleshooting

### Login Issues
- Ensure backend API is running
- Check console for error messages
- Verify credentials are correct

### Data Not Loading
- Check API connection (`http://localhost:8000`)
- Verify CORS is enabled on backend
- Check browser console for errors

### Display Issues
- Clear browser cache
- Try different browser
- Check responsive design breakpoints

## 🚀 Future Enhancements

- [ ] Real-time location tracking map
- [ ] Advanced analytics charts
- [ ] Facial recognition integration
- [ ] Push notifications
- [ ] Multi-language support
- [ ] Dark/Light theme toggle
- [ ] Advanced filtering and search

## 📄 License

Educational Project - MCA Final Year

---

**Built with ❤️ using HTML, CSS, JavaScript, and FastAPI**
