"""
Scheduler job: every minute, find classes starting in 5 minutes (from timetable)
and create notification records for students in that batch who have notifications enabled.

Period start times are read from the `periods` table (admin-editable), in app_timezone.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.timetable import Timetable
from app.models.student import Student
from app.models.notification import Notification
from app.models.period import Period

logger = logging.getLogger(__name__)

# 0 = Monday, 4 = Friday (matches Python weekday with timetable day names)
WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def _period_start_times_local(db: Session) -> dict:
    """period_id -> (hour, minute) from DB; only teaching periods (not breaks)."""
    out = {}
    for p in db.query(Period).filter(Period.period_type == "class").all():
        try:
            sh, sm = [int(x) for x in (p.start_time or "").split(":")]
            out[p.period_id] = (sh, sm)
        except (ValueError, AttributeError):
            continue
    return out


def run_class_reminder_job():
    """Create DB notifications when (local now + 5 min) matches a period start from admin data."""
    db: Session = SessionLocal()
    try:
        tz_name = getattr(settings, "app_timezone", None) or "Asia/Kolkata"
        now = datetime.now(ZoneInfo(tz_name))
        target = now + timedelta(minutes=5)
        target_date = target.date()
        target_weekday = target.weekday()
        if target_weekday >= 5:
            return

        day_name = WEEKDAY_NAMES[target_weekday]
        target_h, target_m = target.hour, target.minute

        period_times = _period_start_times_local(db)
        matching_periods = [
            pid for pid, (h, m) in period_times.items() if h == target_h and m == target_m
        ]
        if not matching_periods:
            return

        timetables = db.query(Timetable).filter(Timetable.is_active == True).all()

        for period_found in matching_periods:
            reminder_key_prefix = f"{target_date.isoformat()}_{day_name}_{period_found}_"

            for tt in timetables:
                data = tt.timetable_data or {}
                day_data = data.get(day_name, {})
                slot = day_data.get(period_found, {})
                if not isinstance(slot, dict) or slot.get("is_break"):
                    continue
                subject = (slot.get("subject") or "").strip()
                class_name = (slot.get("class_name") or "").strip()
                if not subject or not class_name:
                    continue

                reminder_key = f"{reminder_key_prefix}{class_name}"

                students = (
                    db.query(Student)
                    .filter(
                        Student.year == class_name,
                        Student.is_active == True,
                        Student.notification_enabled == True,
                    )
                    .all()
                )

                for student in students:
                    existing = (
                        db.query(Notification)
                        .filter(
                            Notification.student_id == student.id,
                            Notification.reminder_key == reminder_key,
                        )
                        .first()
                    )
                    if existing:
                        continue
                    notification = Notification(
                        student_id=student.id,
                        class_id=None,
                        title="Class reminder",
                        body=f"{subject} starts in 5 minutes",
                        class_start_time=None,
                        reminder_key=reminder_key,
                    )
                    db.add(notification)
                    logger.info(
                        "Created reminder for student %s — %s (%s %s)",
                        student.student_id,
                        subject,
                        day_name,
                        period_found,
                    )
        db.commit()
    except Exception as e:
        logger.exception("Class reminder job failed: %s", e)
        db.rollback()
    finally:
        db.close()
