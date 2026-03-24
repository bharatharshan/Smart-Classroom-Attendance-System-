"""
Resolve attendance for the current calendar session (app timezone).

Weekly recurring slots reuse the same `classes.id`; rows must be scoped by
`session_date` (or legacy NULL + created_at within today's UTC bounds).
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.config import settings
from app.models.attendance import Attendance
from app.utils.attendance_day import local_today_date, utc_naive_bounds_for_local_calendar_day


def get_attendance_for_today_session(
    db: Session, student_id: UUID, class_id: UUID | str
):
    """First attendance row for this student/class for today's calendar day in app timezone."""
    tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    session_today = local_today_date(tz)
    day_start_utc, day_end_utc = utc_naive_bounds_for_local_calendar_day(tz)
    return (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student_id,
            Attendance.class_id == class_id,
            or_(
                Attendance.session_date == session_today,
                and_(
                    Attendance.session_date.is_(None),
                    Attendance.created_at >= day_start_utc,
                    Attendance.created_at < day_end_utc,
                ),
            ),
        )
        .first()
    )
