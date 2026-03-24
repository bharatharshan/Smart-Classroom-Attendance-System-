from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db, SessionLocal
# Import all models so that Base.metadata has them registered before create_all() runs
import app.models  # noqa: F401 — registers Student, Class, Attendance, LocationPing, Faculty, Timetable
from app.models.classroom import Classroom
from app.routes import auth, classes, attendance, face, location_ping
from app.routes import faculty_auth, timetable, faculty_classes, faculty_analytics, classrooms, notifications
from app.routes import admin_stats
from app.models.period import Period
from app.models.subject import Subject
# Temporarily disabled due to face_recognition installation issues
# from app.routes import face_recognition

# Default rooms to seed if missing (101, 102, 811-816; room 101 coords from requirements)
DEFAULT_CLASSROOMS = [
    {"room_id": "101", "room_name": "101", "latitude": 12.930001, "longitude": 77.604696},
    {"room_id": "102", "room_name": "102", "latitude": 13.044969332162152, "longitude": 77.61295540598807},
    {"room_id": "103", "room_name": "103", "latitude": 13.043432, "longitude": 77.625022},
    {"room_id": "811", "room_name": "811", "latitude": 12.930223, "longitude": 77.604928},
    {"room_id": "812", "room_name": "812", "latitude": 12.930334, "longitude": 77.605044},
    {"room_id": "813", "room_name": "813", "latitude": 12.930445, "longitude": 77.605160},
    {"room_id": "814", "room_name": "814", "latitude": 12.930556, "longitude": 77.605276},
    {"room_id": "815", "room_name": "815", "latitude": 12.930667, "longitude": 77.605392},
    {"room_id": "816", "room_name": "816", "latitude": 12.930778, "longitude": 77.605508},
]
DEFAULT_RADIUS = 100.0

DEFAULT_PERIODS = [
    {"period_id": "P1",  "period_name": "Period 1",  "start_time": "07:30", "end_time": "08:15", "period_type": "class", "sort_order": 0},
    {"period_id": "P2",  "period_name": "Period 2",  "start_time": "08:20", "end_time": "09:05", "period_type": "class", "sort_order": 1},
    {"period_id": "P3",  "period_name": "Period 3",  "start_time": "09:10", "end_time": "09:55", "period_type": "class", "sort_order": 2},
    {"period_id": "P4",  "period_name": "Period 4",  "start_time": "10:00", "end_time": "10:45", "period_type": "class", "sort_order": 3},
    {"period_id": "P5",  "period_name": "Period 5",  "start_time": "10:50", "end_time": "11:35", "period_type": "class", "sort_order": 4},
    {"period_id": "P6",  "period_name": "Period 6",  "start_time": "11:40", "end_time": "12:25", "period_type": "class", "sort_order": 5},
    {"period_id": "P7",  "period_name": "Period 7",  "start_time": "12:30", "end_time": "13:15", "period_type": "class", "sort_order": 6},
    {"period_id": "P8",  "period_name": "Period 8",  "start_time": "13:20", "end_time": "14:05", "period_type": "class", "sort_order": 7},
    {"period_id": "P9",  "period_name": "Period 9",  "start_time": "14:10", "end_time": "14:55", "period_type": "class", "sort_order": 8},
    {"period_id": "P10", "period_name": "Period 10", "start_time": "16:05", "end_time": "16:50", "period_type": "class", "sort_order": 9},
]

DEFAULT_SUBJECTS = [
    {"subject_code": "CS401", "subject_name": "Software Engineering",         "course": "MCA", "semester": "6"},
    {"subject_code": "CS402", "subject_name": "Distributed Systems",           "course": "MCA", "semester": "6"},
    {"subject_code": "CS403", "subject_name": "Machine Learning Fundamentals", "course": "MCA", "semester": "6"},
    {"subject_code": "CS404", "subject_name": "Cloud Computing",               "course": "MCA", "semester": "6"},
    {"subject_code": "CS405", "subject_name": "Advanced Database Systems",     "course": "MCA", "semester": "6"},
    {"subject_code": "CS406", "subject_name": "Network Security",              "course": "MCA", "semester": "6"},
    {"subject_code": "CS407", "subject_name": "Data Mining and Warehousing",   "course": "MCA", "semester": "6"},
    {"subject_code": "CS408", "subject_name": "Web Application Development",   "course": "MCA", "semester": "6"},
    {"subject_code": "CS409", "subject_name": "Mobile Application Development","course": "MCA", "semester": "6"},
    {"subject_code": "CS410", "subject_name": "Artificial Intelligence",       "course": "MCA", "semester": "6"},
]

# Create FastAPI application
app = FastAPI(
    title="Smart Classroom Attendance System",
    description="Backend API for Smart Classroom Attendance using adaptive location tracking and facial recognition",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware (for future frontend integration)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(classes.router)
app.include_router(attendance.router)
app.include_router(location_ping.router)
app.include_router(face.router)  # Phase 5: 3D facial recognition
# Temporarily disabled due to face_recognition installation issues
# app.include_router(face_recognition.router)  # Face recognition endpoints

# Faculty routes
app.include_router(faculty_auth.router)  # Faculty authentication
app.include_router(timetable.router)  # Faculty timetable management
app.include_router(faculty_classes.router)  # Faculty class management
app.include_router(faculty_analytics.router)  # Faculty dashboard analytics / charts
app.include_router(classrooms.router)  # Classrooms (geo) for timetable room selection
app.include_router(notifications.router)  # Student notifications (class reminders)

# Admin routes
app.include_router(admin_stats.router)

@app.on_event("startup")
def on_startup():
    """Initialize database tables and seed default classrooms if missing."""
    init_db()
    print("Database tables created successfully")
    # Seed default classrooms so room dropdown always has options
    db = SessionLocal()
    try:
        for r in DEFAULT_CLASSROOMS:
            existing = db.query(Classroom).filter(Classroom.room_id == r["room_id"]).first()
            if not existing:
                room = Classroom(
                    room_id=r["room_id"],
                    room_name=r["room_name"],
                    latitude=r["latitude"],
                    longitude=r["longitude"],
                    allowed_radius=DEFAULT_RADIUS,
                )
                db.add(room)
                print(f"  Created room {r['room_id']}")
        db.commit()
    except Exception as e:
        print(f"  Classroom seed warning: {e}")
        db.rollback()
    finally:
        db.close()

    # Seed default periods if missing
    db = SessionLocal()
    try:
        for p in DEFAULT_PERIODS:
            existing = db.query(Period).filter(Period.period_id == p["period_id"]).first()
            if not existing:
                db.add(Period(
                    period_id=p["period_id"],
                    period_name=p["period_name"],
                    start_time=p["start_time"],
                    end_time=p["end_time"],
                    period_type=p["period_type"],
                    sort_order=p.get("sort_order", 0),
                ))
                print(f"  Created period {p['period_id']}")
        db.commit()
    except Exception as e:
        print(f"  Period seed warning: {e}")
        db.rollback()
    finally:
        db.close()

    # Seed default subjects if missing
    db = SessionLocal()
    try:
        for s in DEFAULT_SUBJECTS:
            existing = db.query(Subject).filter(Subject.subject_code == s["subject_code"]).first()
            if not existing:
                db.add(Subject(
                    subject_code=s["subject_code"],
                    subject_name=s["subject_name"],
                    course=s["course"],
                    semester=s["semester"],
                ))
                print(f"  Created subject {s['subject_code']}")
        db.commit()
    except Exception as e:
        print(f"  Subject seed warning: {e}")
        db.rollback()
    finally:
        db.close()

    # Start APScheduler for class reminder notifications
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.services.notification_scheduler import run_class_reminder_job
    from app.services.attendance_absent_scheduler import run_mark_absent_job
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_class_reminder_job, "interval", minutes=1, id="class_reminders")
    scheduler.add_job(run_mark_absent_job, "interval", minutes=1, id="mark_absent")
    scheduler.start()
    print("Notification scheduler started (class reminders + mark absent every 1 min)")


@app.get("/", tags=["Health Check"])
def health_check():
    """
    Health check endpoint to verify API is running.
    """
    return {
        "status": "healthy",
        "message": "Smart Classroom Attendance System API is running",
        "version": "3.0.0",
        "phase": "Core backend, geofencing, adaptive pinging, and attendance APIs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
