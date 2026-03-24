"""
Scheduler job: every minute, for classes whose attendance window has closed (>10 min after start),
mark as Absent any enrolled student who has not submitted attendance.
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.class_model import Class
from app.models.enrollment import ClassEnrollment
from app.models.attendance import Attendance, AttendanceStatus
from app.config import settings
from app.utils.attendance_day import local_today_date
from app.utils.attendance_session import get_attendance_for_today_session

logger = logging.getLogger(__name__)
WINDOW_CLOSE_MINUTES = 10


def run_mark_absent_job():
    """Create Absent records for enrolled students who did not mark within 10 min of class start.
    Scoped to today's calendar session per class (same class_id recurs weekly)."""
    db: Session = SessionLocal()
    try:
        tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
        today_date = local_today_date(tz)

        now = datetime.utcnow()
        cutoff = now - timedelta(minutes=WINDOW_CLOSE_MINUTES)
        # Classes that started more than 10 minutes ago (attendance window closed)
        classes_closed = (
            db.query(Class)
            .filter(
                Class.is_active == True,
                Class.start_time <= cutoff,
            )
            .all()
        )
        for class_obj in classes_closed:
            # Only today's scheduled classes (avoid stale rows / wrong "already marked")
            if class_obj.start_time.date() != today_date:
                continue
            enrollments = (
                db.query(ClassEnrollment)
                .filter(ClassEnrollment.class_id == class_obj.id)
                .all()
            )
            for enr in enrollments:
                existing = get_attendance_for_today_session(
                    db, enr.student_id, class_obj.id
                )
                if existing:
                    continue
                attendance = Attendance(
                    student_id=enr.student_id,
                    class_id=class_obj.id,
                    entry_time=None,
                    capture_time=now,
                    session_date=today_date,
                    status=AttendanceStatus.ABSENT,
                    face_verified=False,
                    location_verified=False,
                )
                db.add(attendance)
                logger.info(f"Marked absent: student {enr.student_id} class {class_obj.class_code}")
        db.commit()
    except Exception as e:
        logger.exception("Mark-absent job failed: %s", e)
        db.rollback()
    finally:
        db.close()
