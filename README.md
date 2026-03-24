# Smart Classroom Attendance System

**Final Year Project**

Backend API for Smart Classroom Attendance using adaptive location tracking and facial recognition.

## 🎯 Project Overview

**Final-Year MCA Project**

This system provides a comprehensive solution for tracking student attendance using:
- **Geo-fencing** (Phase 3) ✅
- **Adaptive Location Tracking** (Phase 4) ✅
- **Facial Recognition** (Phase 5)

**Current Status:** Core phases complete ✅
- ✅ FastAPI backend setup
- ✅ PostgreSQL database integration
- ✅ Student registration & authentication
- ✅ Class management
- ✅ Core attendance logic (entry/exit with 75% rule)
- ✅ Geo-fencing with location validation
- ✅ Adaptive location pinging
## 🛠️ Tech Stack

- **Backend:** Python, FastAPI
- **Database:** PostgreSQL
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcrypt
- **ORM:** SQLAlchemy
- **Geo-location:** Haversine formula

## 📁 Project Structure

```
Final-Year/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection and session
│   ├── models/              # SQLAlchemy models
│   │   ├── student.py
│   │   ├── class_model.py
│   │   └── attendance.py
│   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── student.py
│   │   ├── class_schema.py
│   │   └── attendance.py
│   ├── routes/              # API endpoints
│   │   ├── auth.py
│   │   ├── classes.py
│   │   └── attendance.py
│   └── utils/               # Utilities
│       ├── security.py      # Password hashing, JWT
│       ├── dependencies.py  # FastAPI dependencies
│       ├── geofence.py      # Location validation
├── .env.example             # Environment variables template
├── .gitignore
├── requirements.txt
├── setup.bat
└── README.md
```

## 🚀 Setup Instructions

### Prerequisites

- Python 3.9+
- PostgreSQL 12+
- pip (Python package manager)

### 1. Clone/Navigate to Project

```bash
cd d:/Final-Year
```

### 2. Create Virtual Environment (Recommended)

```bash
python -m venv venv
venv\Scripts\activate  # On Windows
# source venv/bin/activate  # On Linux/Mac
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Setup PostgreSQL Database

1. Install PostgreSQL if not already installed
2. Create a new database:

```sql
CREATE DATABASE smart_classroom_db;
```

### 5. Configure Environment Variables

1. Copy `.env.example` to `.env`:

```bash
copy .env.example .env  # On Windows
# cp .env.example .env  # On Linux/Mac
```

2. Edit `.env` and update with your PostgreSQL credentials:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=smart_classroom_db
DATABASE_USER=postgres
DATABASE_PASSWORD=your_actual_password

SECRET_KEY=your-secret-key-here-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Generate a secure SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 6. Run the Application

```bash
uvicorn app.main:app --reload
```

The API will be available at: `http://localhost:8000`

**Using the React client (`client/`):** If another project already uses port **8000** (faculty login may show **404 Not Found** because requests hit the wrong API), run this app on **8001** and use the default `client/.env.development`:

```bash
uvicorn app.main:app --reload --port 8001
```

Then open `http://localhost:5173` — Vite proxies `/api` to port **8001**.

## 📚 API Documentation

Once the server is running, access:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## 🔑 API Endpoints

### Health Check
- `GET /` - Health check endpoint

### Authentication
- `POST /auth/register` - Register new student
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current student info (requires auth)

### Classes
- `POST /classes` - Create new class with geofence (requires auth)
- `GET /classes` - List all active classes
- `GET /classes/{class_id}` - Get class details

### Attendance (with Geo-fencing)
- `POST /attendance/entry` - Mark attendance entry (requires auth + GPS)
- `POST /attendance/exit` - Mark attendance exit (requires auth + GPS)
- `GET /attendance/student/{student_id}` - Get student's attendance history (requires auth)
- `GET /attendance/class/{class_id}` - Get class attendance records (requires auth)

## 🆕 Phase 3: Geo-fencing

### How It Works

Each class has a geofence defined by:
- **Latitude:** Classroom center point (e.g., 28.6139)
- **Longitude:** Classroom center point (e.g., 77.2090)
- **Radius:** Acceptable distance in meters (e.g., 50m)

Students can only mark attendance if their GPS coordinates fall within this geofence.

### Example: Create Class with Geofence

```bash
POST /classes
Authorization: Bearer <your_token>

{
  "class_code": "CS101",
  "subject_name": "Data Structures",
  "faculty_name": "Dr. Smith",
  "start_time": "2026-01-27T10:00:00",
  "end_time": "2026-01-27T11:30:00",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius": 50
}
```

### Example: Mark Entry (Inside Geofence)

```bash
POST /attendance/entry
Authorization: Bearer <your_token>

{
  "student_id": "<student_uuid>",
  "class_id": "<class_uuid>",
  "latitude": 28.6140,
  "longitude": 77.2091
}
```

**Result:** ✅ Success (student is ~15m away, within 50m radius)

### Example: Mark Entry (Outside Geofence)

```bash
POST /attendance/entry
Authorization: Bearer <your_token>

{
  "student_id": "<student_uuid>",
  "class_id": "<class_uuid>",
  "latitude": 28.6200,
  "longitude": 77.2200
}
```

**Result:** ❌ Error 403 - "You are 1400m away. Please move within 50m."

## 🧪 Testing the API

### 1. Register a Student

```bash
POST /auth/register
{
  "student_id": "MCA2024001",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "department": "Computer Science",
  "year": "MCA 1st Year"
}
```

### 2. Login

```bash
POST /auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 3. Get GPS Coordinates

**Using Google Maps:**
1. Right-click on your classroom location
2. Click "What's here?"
3. Copy latitude and longitude

### 4. Create Class with Geofence

Use the coordinates from step 3 and set an appropriate radius (e.g., 50 meters).

### 5. Test Geo-fencing

Try marking entry from:
- ✅ Inside the geofence (should succeed)
- ❌ Outside the geofence (should fail with distance info)

## 📊 Database Models

### Student
- `id` (UUID) - Primary key
- `student_id` (String) - Unique roll number
- `name`, `email` (unique)
- `hashed_password`
- `department`, `year`
- `is_active` (Boolean)
- Timestamps: `created_at`, `updated_at`

### Class
- `id` (UUID) - Primary key
- `class_code` (String) - Unique identifier
- `subject_name`, `faculty_name`
- `start_time`, `end_time` (DateTime)
- `latitude`, `longitude`, `radius` (Geofence - **now required**)
- `is_active` (Boolean)
- Timestamps: `created_at`, `updated_at`

### Attendance
- `id` (UUID) - Primary key
- `student_id`, `class_id` (Foreign keys)
- `entry_time`, `exit_time` (DateTime)
- `duration_minutes` (Integer)
- `status` (Enum: IN_PROGRESS, PRESENT, ABSENT)
- Timestamps: `created_at`, `updated_at`
- **Unique constraint:** One attendance per student per class

## 🎯 Attendance Logic

### Entry
- Records `entry_time`
- Sets status to `IN_PROGRESS`
- **🆕 Validates GPS location (must be inside geofence)**
- Prevents duplicate entries

### Exit
- Records `exit_time`
- Calculates `duration_minutes`
- **🆕 Logs warning if outside geofence (still allows exit)**
- **75% Rule:** 
  - If duration ≥ 75% of class time → `PRESENT`
  - If duration < 75% of class time → `ABSENT`

### Edge Cases Handled
- ✅ Duplicate entry prevention
- ✅ Exit without entry validation
- ✅ Class time validation
- ✅ **Outside geofence rejection** 🆕
- ✅ **Invalid GPS coordinates** 🆕

## 🗺️ Development Roadmap

- [x] **Phase 1:** Project Setup & Database
- [x] **Phase 2:** Core Attendance Logic
- [x] **Phase 3:** Geo-fencing ✅
- [x] **Phase 4:** Adaptive Periodic Location Pinging ✅
- [x] **Phase 5:** 3D Facial Recognition ✅
- [ ] **Phase 7:** Frontend (Mobile App + Web Dashboard)
- [ ] **Phase 8:** Testing & Documentation

### Phase 5: 3D Facial Recognition (Backend)

Phase 5 adds backend support for **3D facial recognition** using model-agnostic face embeddings:

- Students enroll a **3D face embedding** once (e.g., from a browser/mobile 3D face model).
- On every attendance entry, the client can send a fresh 3D embedding for verification.
- The backend compares embeddings using cosine similarity and enforces a similarity threshold.

**Key Concepts:**

- The actual 3D face processing (camera, depth, landmarks, neural network, etc.) runs on the **client**.
- The backend stores only:
  - A JSON-encoded embedding vector (`students.face_embedding`)
  - A model identifier (`students.face_embedding_model`)
  - An enrollment flag (`students.face_enrolled`)
- Verification is done by comparing the stored embedding with the live embedding.

**New Settings (.env):**

```env
# Phase 5: 3D Facial Recognition
FACE_RECOGNITION_ENABLED=True
FACE_SIMILARITY_THRESHOLD=0.80
```

These map to `settings.face_recognition_enabled` and `settings.face_similarity_threshold`.  
When disabled, attendance works as before (GPS-only).

**New Endpoints (Phase 5):**

- `POST /face/enroll` – Enroll or update the current student's 3D face template.
  - Auth required (Bearer token).
  - Body:
    ```json
    {
      "embedding": [0.12, -0.34, 0.56, "..."],
      "model": "browser-3d-face-v1"
    }
    ```
- `POST /face/verify` – Verify a live embedding against the enrolled template.
  - Returns:
    ```json
    {
      "matched": true,
      "similarity": 0.91,
      "model": "browser-3d-face-v1",
      "face_enrolled": true
    }
    ```

**Attendance With Face Verification:**

- When `FACE_RECOGNITION_ENABLED=True`, `POST /attendance/entry` expects an additional field:

```json
{
  "student_id": "<uuid>",
  "class_id": "<uuid>",
  "latitude": 28.6140,
  "longitude": 77.2091,
  "face_embedding": [0.12, -0.34, 0.56, "..."]
}
```

- If the student's face is not enrolled or similarity is below threshold, entry is rejected with `403`.

## 🔒 Security Features

- Password hashing using bcrypt
- JWT-based authentication
- Token expiration (configurable)
- SQL injection prevention (SQLAlchemy ORM)
- Input validation (Pydantic)
- **GPS coordinate validation**
- **Geofence radius limits (max 1km)**

## 📝 Notes

- Currently, any authenticated student can create classes (for testing). In production, restrict this to faculty only.
- Geofence validation is **enforced** at entry.
- Exit from outside geofence is **allowed** but logged for review.
- All timestamps use UTC.
- GPS accuracy: ±5-10 meters (typical smartphone GPS)

## 🤝 Contributing

This is a final-year MCA project. Contributions and suggestions are welcome!

## 📄 License

Educational Project - MCA Final Year

---

**Built with FastAPI and PostgreSQL**
