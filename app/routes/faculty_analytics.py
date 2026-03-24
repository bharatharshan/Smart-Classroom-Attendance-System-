"""
Aggregated attendance analytics for the faculty dashboard (charts).
"""
from __future__ import annotations

import re
import uuid as uuid_lib
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sqla_func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.class_model import Class
from app.models.enrollment import ClassEnrollment
from app.models.student import Student
from app.utils.attendance_day import local_today_date
from app.utils.faculty_dependencies import get_current_faculty

router = APIRouter(prefix="/faculty/analytics", tags=["Faculty Analytics"])

AT_RISK_THRESHOLD = 75.0  # percent below this = at risk
# Include students with any marked attendance so lists populate with sparse data
MIN_SESSIONS_FOR_RANKING = 1

# e.g. "CS403 - Advanced Database" → CS403 when subject_code is empty
_SUBJECT_CODE_IN_NAME = re.compile(r"\b([A-Z]{2}\d{3}[A-Z0-9]?)\b")


_DAY_ORDER = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}


def _timetable_slot_sort_key(c: Optional[Class]) -> Tuple[int, str]:
    """Order bars like the timetable: weekday then period id."""
    if not c or not c.class_code:
        return (99, "")
    parts = c.class_code.split("_")
    if len(parts) < 3:
        return (99, c.class_code)
    day_abbrev = parts[1]
    period_id = "_".join(parts[2:])
    return (_DAY_ORDER.get(day_abbrev, 99), period_id)


def _slot_suffix_from_class_code(class_code: Optional[str]) -> Optional[str]:
    """Timetable sync uses `{faculty8}_{Day3}_{period_id}` — disambiguate bars per slot."""
    if not class_code or not isinstance(class_code, str):
        return None
    parts = class_code.split("_")
    if len(parts) < 3:
        return None
    day_abbrev = parts[1]
    period_id = "_".join(parts[2:])
    return f"{day_abbrev} {period_id}"


def _chart_label_for_class(c: Optional[Class]) -> str:
    """Short label: subject code + day/period so each Class row is its own bar."""
    if not c:
        return "—"
    subj = c.subject_name or "—"
    code = (c.subject_code or "").strip()
    inferred = _SUBJECT_CODE_IN_NAME.search(subj) if subj and subj != "—" else None
    inferred_code = inferred.group(1) if inferred else ""
    if code:
        base = code
    elif inferred_code:
        base = inferred_code
    elif subj and subj != "—":
        base = (subj[:12] + "…") if len(subj) > 12 else subj
    else:
        base = "—"
    suffix = _slot_suffix_from_class_code(c.class_code)
    if suffix:
        return f"{base} · {suffix}" if base != "—" else suffix
    return base


def _faculty_class_ids(db: Session, faculty_id: str) -> List[Any]:
    return [
        r[0]
        for r in db.query(Class.id)
        .filter(Class.faculty_id == faculty_id, Class.is_active == True)
        .all()
    ]


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _status_bucket(st: AttendanceStatus) -> str:
    if st == AttendanceStatus.PRESENT:
        return "present"
    if st == AttendanceStatus.LATE:
        return "late"
    if st == AttendanceStatus.ABSENT:
        return "absent"
    return "other"


@router.get("/dashboard")
def get_faculty_dashboard_analytics(
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty),
    days: int = Query(30, ge=7, le=120, description="Lookback window for most series"),
    daily_days: int = Query(14, ge=7, le=30, description="Days for daily trend chart"),
) -> Dict[str, Any]:
    """
    Returns data for faculty dashboard charts plus student lists: at-risk, top attenders, chronic absentees.
    """
    fid = str(current_faculty.id)
    class_ids = _faculty_class_ids(db, fid)
    if not class_ids:
        empty = []
        return {
            "date_from": None,
            "date_to": None,
            "timezone": getattr(settings, "app_timezone", "Asia/Kolkata"),
            "weekly_trend": empty,
            "daily_trend": empty,
            "status_stacked_by_week": empty,
            "status_stacked_by_subject": {"__all__": empty},
            "status_stacked_today": empty,
            "today_enrollment_vs_marked": empty,
            "students_at_risk": empty,
            "top_attenders": empty,
            "chronic_absentees": empty,
            "at_risk_threshold_percent": AT_RISK_THRESHOLD,
            "min_sessions_for_ranking": MIN_SESSIONS_FOR_RANKING,
        }

    tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    today = local_today_date(tz)
    end_d = today
    start_d = today - timedelta(days=days - 1)
    daily_start = today - timedelta(days=daily_days - 1)

    rows = (
        db.query(Attendance, Class.subject_name, Class.class_code)
        .join(Class, Attendance.class_id == Class.id)
        .filter(Class.id.in_(class_ids))
        .filter(Attendance.session_date >= start_d, Attendance.session_date <= end_d)
        .all()
    )

    # --- Weekly aggregates (charts 1 & 2) ---
    week_status: Dict[date, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    week_subject: Dict[tuple, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for att, sn, cc in rows:
        wk = _week_start(att.session_date)
        bucket = _status_bucket(att.status)
        if bucket != "other":
            week_status[wk][bucket] += 1
            subj = (sn or "").strip() or "Unknown"
            week_subject[(wk, subj)][bucket] += 1

    weekly_trend: List[Dict[str, Any]] = []
    status_stacked_by_week: List[Dict[str, Any]] = []
    for wk in sorted(week_status.keys()):
        p = week_status[wk].get("present", 0)
        l = week_status[wk].get("late", 0)
        a = week_status[wk].get("absent", 0)
        denom = p + l + a
        rate = round(100.0 * (p + l) / denom, 1) if denom else 0.0
        weekly_trend.append(
            {
                "week_start": wk.isoformat(),
                "label": wk.strftime("%d %b"),
                "rate_percent": rate,
                "present": p,
                "late": l,
                "absent": a,
            }
        )
        status_stacked_by_week.append(
            {
                "week_start": wk.isoformat(),
                "label": wk.strftime("%d %b"),
                "present": p,
                "late": l,
                "absent": a,
            }
        )

    # Same weeks on X-axis; filter stacks by subject in the UI
    week_keys_sorted = sorted(week_status.keys())
    status_stacked_by_subject: Dict[str, List[Dict[str, Any]]] = {
        "__all__": status_stacked_by_week,
    }
    subject_names = sorted({s for (_, s) in week_subject.keys()})
    for subj in subject_names:
        subj_rows: List[Dict[str, Any]] = []
        for wk in week_keys_sorted:
            dct = week_subject[(wk, subj)]
            p = int(dct.get("present", 0))
            l = int(dct.get("late", 0))
            a = int(dct.get("absent", 0))
            subj_rows.append(
                {
                    "week_start": wk.isoformat(),
                    "label": wk.strftime("%d %b"),
                    "present": p,
                    "late": l,
                    "absent": a,
                }
            )
        status_stacked_by_subject[subj] = subj_rows

    # --- Daily trend (chart 3) ---
    day_status: Dict[date, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for att, _sn, cc in rows:
        if att.session_date < daily_start:
            continue
        bucket = _status_bucket(att.status)
        if bucket != "other":
            day_status[att.session_date][bucket] += 1

    daily_trend: List[Dict[str, Any]] = []
    d = daily_start
    while d <= today:
        p = day_status[d].get("present", 0)
        l = day_status[d].get("late", 0)
        a = day_status[d].get("absent", 0)
        denom = p + l + a
        rate = round(100.0 * (p + l) / denom, 1) if denom else 0.0
        daily_trend.append(
            {
                "date": d.isoformat(),
                "label": d.strftime("%d %b"),
                "rate_percent": rate,
                "present": p,
                "late": l,
                "absent": a,
            }
        )
        d += timedelta(days=1)

    # --- Today enrollment vs marked ---
    enc_map: Dict[Any, int] = {}
    for cid in class_ids:
        enc_map[cid] = (
            db.query(sqla_func.count(ClassEnrollment.id))
            .filter(ClassEnrollment.class_id == cid)
            .scalar()
            or 0
        )

    marked_today: Dict[Any, int] = defaultdict(int)
    today_status_counts: Dict[Any, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for att, _sn, _cc in rows:
        if att.session_date != today:
            continue
        b = _status_bucket(att.status)
        if b in ("present", "late", "absent"):
            marked_today[att.class_id] += 1
        if b != "other":
            today_status_counts[att.class_id][b] += 1

    cls_meta = {c.id: c for c in db.query(Class).filter(Class.id.in_(class_ids)).all()}

    status_stacked_today: List[Dict[str, Any]] = []
    for cid in class_ids:
        tc = today_status_counts.get(cid) or {}
        p = int(tc.get("present", 0))
        l = int(tc.get("late", 0))
        a = int(tc.get("absent", 0))
        if p + l + a == 0:
            continue
        c = cls_meta.get(cid)
        subj = c.subject_name if c else "—"
        status_stacked_today.append(
            {
                "class_id": str(cid),
                "chart_label": _chart_label_for_class(c),
                "subject_name": subj,
                "present": p,
                "late": l,
                "absent": a,
            }
        )
    def _row_slot_sort(x: Dict[str, Any]) -> Tuple[int, str]:
        try:
            uid = uuid_lib.UUID(str(x["class_id"]))
            return _timetable_slot_sort_key(cls_meta.get(uid))
        except (ValueError, TypeError, KeyError):
            return (99, str(x.get("chart_label") or ""))

    status_stacked_today.sort(key=_row_slot_sort)

    today_enrollment_vs_marked: List[Dict[str, Any]] = []
    for cid in class_ids:
        c = cls_meta.get(cid)
        subj = c.subject_name if c else "—"
        bat = (c.batch or "").strip() if c else ""
        code = (c.subject_code or "").strip() if c else ""
        chart_label = _chart_label_for_class(c)
        today_enrollment_vs_marked.append(
            {
                "class_id": str(cid),
                "subject_name": subj,
                "subject_code": code or None,
                "batch": bat or None,
                "chart_label": chart_label,
                "enrolled": int(enc_map.get(cid, 0)),
                "marked": int(marked_today.get(cid, 0)),
            }
        )
    today_enrollment_vs_marked.sort(key=_row_slot_sort)

    # --- Per-student rates (at risk, top / chronic) — same date range as `rows` ---
    student_stats: Dict[Any, Dict[str, int]] = defaultdict(
        lambda: {"present": 0, "late": 0, "absent": 0}
    )
    for att, _sn, _cc in rows:
        sid = att.student_id
        b = _status_bucket(att.status)
        if b == "present":
            student_stats[sid]["present"] += 1
        elif b == "late":
            student_stats[sid]["late"] += 1
        elif b == "absent":
            student_stats[sid]["absent"] += 1

    student_names: Dict[Any, str] = {}
    if student_stats:
        studs = (
            db.query(Student.id, Student.name, Student.student_id)
            .filter(Student.id.in_(student_stats.keys()))
            .all()
        )
        for sid, name, sid_code in studs:
            student_names[sid] = f"{name} ({sid_code})"

    student_rates: List[Dict[str, Any]] = []
    for sid, agg in student_stats.items():
        p, l, a = agg["present"], agg["late"], agg["absent"]
        denom = p + l + a
        if denom < MIN_SESSIONS_FOR_RANKING:
            continue
        rate = round(100.0 * (p + l) / denom, 1)
        student_rates.append(
            {
                "student_db_id": str(sid),
                "label": student_names.get(sid, str(sid)),
                "rate_percent": rate,
                "sessions": denom,
            }
        )

    students_at_risk = sorted(
        [x for x in student_rates if x["rate_percent"] < AT_RISK_THRESHOLD],
        key=lambda x: x["rate_percent"],
    )[:15]

    top_attenders = sorted(student_rates, key=lambda x: -x["rate_percent"])[:8]
    chronic_absentees = sorted(student_rates, key=lambda x: x["rate_percent"])[:8]

    return {
        "date_from": start_d.isoformat(),
        "date_to": end_d.isoformat(),
        "timezone": tz,
        "weekly_trend": weekly_trend,
        "daily_trend": daily_trend,
        "status_stacked_by_week": status_stacked_by_week,
        "status_stacked_by_subject": status_stacked_by_subject,
        "status_stacked_today": status_stacked_today,
        "today_enrollment_vs_marked": today_enrollment_vs_marked,
        "min_sessions_for_ranking": MIN_SESSIONS_FOR_RANKING,
        "students_at_risk": students_at_risk,
        "top_attenders": top_attenders,
        "chronic_absentees": chronic_absentees,
        "at_risk_threshold_percent": AT_RISK_THRESHOLD,
    }
