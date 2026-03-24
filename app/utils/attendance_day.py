"""
Consistent calendar day + weekday for attendance (classes + attendance records).

DB stores naive UTC datetimes (datetime.utcnow). "Today" for marking must use one
timezone so Fri in India does not compare against Thu UTC midnight.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Tuple
from zoneinfo import ZoneInfo

# Weekday abbreviations used in class_code: fid_Fri_P1
_WEEKDAY_ABBR = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def local_weekday_abbr(tz_name: str) -> str:
    """e.g. 'Fri' — must match class_code segment from timetable sync."""
    z = ZoneInfo(tz_name)
    d = datetime.now(z)
    return _WEEKDAY_ABBR[d.weekday()]


def local_today_date(tz_name: str) -> date:
    return datetime.now(ZoneInfo(tz_name)).date()


def utc_naive_bounds_for_local_calendar_day(tz_name: str) -> Tuple[datetime, datetime]:
    """
    Start/end as naive UTC datetimes matching [start, end) for the current calendar
    day in the given timezone — comparable to Attendance.created_at (utcnow naive).
    """
    z = ZoneInfo(tz_name)
    now_local = datetime.now(z)
    start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end_local = start_local + timedelta(days=1)
    utc = ZoneInfo("UTC")
    start_utc = start_local.astimezone(utc).replace(tzinfo=None)
    end_utc = end_local.astimezone(utc).replace(tzinfo=None)
    return start_utc, end_utc
