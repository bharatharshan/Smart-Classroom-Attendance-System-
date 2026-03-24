"""
Faculty-side class management routes.

Classes are now auto-created from timetable slots when faculty saves their timetable.
These endpoints are view-only (no manual class creation).

Endpoints:
  GET  /faculty/classes               - list classes created from timetable
  GET  /faculty/classes/{id}/students - enrolled students + attendance
  GET  /faculty/classes/{id}/students/attendance-summary - per-student present/late/absent counts
  PATCH /faculty/classes/{id}/deactivate - deactivate a class
"""
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List

from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.class_model import Class
from app.models.enrollment import ClassEnrollment
from app.models.student import Student
from app.utils.attendance_session import get_attendance_for_today_session
from app.schemas.class_schema import ClassResponse, FacultyRecentClassItem
from app.schemas.enrollment import (
    EnrolledStudentInfo,
    StudentAttendanceRecord,
    StudentAttendanceSummaryResponse,
    StudentLastSessionRow,
    StudentsLastSessionResponse,
)
from app.utils.faculty_dependencies import get_current_faculty
from app.config import settings
from app.utils.attendance_day import local_today_date

router = APIRouter(prefix="/faculty/classes", tags=["Faculty Classes"])


def _status_label(status) -> tuple:
    """Returns (raw_value_or_None, display_label)."""
    if status is None:
        return None, "No record"
    if status == AttendanceStatus.PRESENT:
        return status.value, "On time"
    if status == AttendanceStatus.LATE:
        return status.value, "Late"
    if status == AttendanceStatus.ABSENT:
        return status.value, "Absent"
    if status == AttendanceStatus.IN_PROGRESS:
        return status.value, "In progress"
    v = getattr(status, "value", str(status))
    return v, v


@router.get("", response_model=List[ClassResponse])
def list_faculty_classes(
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty)
):
    """List all active classes auto-created from the faculty's timetable."""
    classes = db.query(Class).filter(
        Class.faculty_id == str(current_faculty.id),
        Class.is_active == True
    ).order_by(Class.start_time.asc()).all()
    return [ClassResponse.from_orm(c) for c in classes]


@router.get("/recent", response_model=List[FacultyRecentClassItem])
def list_recent_faculty_classes(
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty),
    limit: int = Query(5, ge=1, le=20),
):
    """
    Classes with the most recent attendance activity first (by latest session_date),
    then by updated time. For My Classes → Recent Classes.
    """
    classes = (
        db.query(Class)
        .filter(
            Class.faculty_id == str(current_faculty.id),
            Class.is_active == True,
        )
        .all()
    )
    if not classes:
        return []

    last_by = {}
    for c in classes:
        mx = (
            db.query(func.max(Attendance.session_date))
            .filter(Attendance.class_id == c.id)
            .scalar()
        )
        last_by[c.id] = mx

    sorted_classes = sorted(
        classes,
        key=lambda c: (
            last_by.get(c.id) or date_type.min,
            c.updated_at.timestamp() if c.updated_at else 0.0,
        ),
        reverse=True,
    )[:limit]

    out: List[FacultyRecentClassItem] = []
    for c in sorted_classes:
        base = ClassResponse.from_orm(c).model_dump()
        la = last_by.get(c.id)
        out.append(
            FacultyRecentClassItem(
                **base,
                last_activity_date=la.isoformat() if la else None,
            )
        )
    return out


@router.get(
    "/{class_id}/students/attendance-summary",
    response_model=StudentAttendanceSummaryResponse,
)
def get_student_attendance_summary(
    class_id: str,
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty),
):
    """
    All enrolled students with present / late / absent counts for this class (all sessions).
    """
    class_obj = db.query(Class).filter(
        Class.id == class_id,
        Class.faculty_id == str(current_faculty.id),
        Class.is_active == True,
    ).first()

    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found or you don't have permission to view it",
        )

    enrollments = (
        db.query(ClassEnrollment)
        .filter(ClassEnrollment.class_id == class_id)
        .all()
    )
    student_ids = [e.student_id for e in enrollments]
    students_by_id = {}
    if student_ids:
        for s in db.query(Student).filter(Student.id.in_(student_ids)).all():
            students_by_id[s.id] = s

    counts = {sid: {"present": 0, "late": 0, "absent": 0} for sid in student_ids}

    att_rows = (
        db.query(Attendance)
        .filter(Attendance.class_id == class_id)
        .all()
    )
    for att in att_rows:
        if att.student_id not in counts:
            continue
        st = att.status
        if st == AttendanceStatus.PRESENT:
            counts[att.student_id]["present"] += 1
        elif st == AttendanceStatus.LATE:
            counts[att.student_id]["late"] += 1
        elif st == AttendanceStatus.ABSENT:
            counts[att.student_id]["absent"] += 1
        # IN_PROGRESS and others: not counted in these three

    out: List[StudentAttendanceRecord] = []
    for sid in student_ids:
        stu = students_by_id.get(sid)
        if not stu:
            continue
        c = counts[sid]
        tot = c["present"] + c["late"] + c["absent"]
        out.append(
            StudentAttendanceRecord(
                student_id=stu.student_id,
                name=stu.name,
                email=stu.email,
                present=c["present"],
                late=c["late"],
                absent=c["absent"],
                total_sessions=tot,
            )
        )
    out.sort(key=lambda r: (r.name or "").lower())

    return StudentAttendanceSummaryResponse(
        class_id=str(class_obj.id),
        subject_name=class_obj.subject_name or "",
        subject_code=class_obj.subject_code,
        class_code=class_obj.class_code or "",
        batch=class_obj.batch,
        students=out,
    )


@router.get(
    "/{class_id}/students/last-session",
    response_model=StudentsLastSessionResponse,
)
def get_students_last_session_status(
    class_id: str,
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty),
):
    """
    Each enrolled student with their most recent attendance for this class
    (on time / late / absent / in progress / no record).
    """
    class_obj = db.query(Class).filter(
        Class.id == class_id,
        Class.faculty_id == str(current_faculty.id),
        Class.is_active == True,
    ).first()

    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found or you don't have permission to view it",
        )

    enrollments = (
        db.query(ClassEnrollment)
        .filter(ClassEnrollment.class_id == class_id)
        .all()
    )

    rows: List[StudentLastSessionRow] = []
    for enrollment in enrollments:
        student = enrollment.student
        att = (
            db.query(Attendance)
            .filter(
                Attendance.class_id == class_id,
                Attendance.student_id == student.id,
            )
            .order_by(desc(Attendance.session_date), desc(Attendance.created_at))
            .first()
        )
        raw, label = _status_label(att.status if att else None)
        last_d = att.session_date.isoformat() if att and att.session_date else None

        rows.append(
            StudentLastSessionRow(
                student_id=student.student_id,
                student_db_id=str(student.id),
                name=student.name,
                email=student.email,
                year=student.year,
                last_session_date=last_d,
                status=raw,
                status_label=label,
            )
        )
    rows.sort(key=lambda r: (r.name or "").lower())

    return StudentsLastSessionResponse(
        class_id=str(class_obj.id),
        subject_name=class_obj.subject_name or "",
        class_code=class_obj.class_code or "",
        batch=class_obj.batch,
        students=rows,
    )


@router.get("/{class_id}/students", response_model=List[EnrolledStudentInfo])
def get_enrolled_students(
    class_id: str,
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty)
):
    """
    Get all enrolled students for a specific class, including their attendance status.
    Only the faculty who owns the class can view this.
    """
    class_obj = db.query(Class).filter(
        Class.id == class_id,
        Class.faculty_id == current_faculty.id
    ).first()

    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found or you don't have permission to view it"
        )

    enrollments = db.query(ClassEnrollment).filter(
        ClassEnrollment.class_id == class_id
    ).all()

    result = []
    for enrollment in enrollments:
        student = enrollment.student
        attendance = get_attendance_for_today_session(db, student.id, class_id)

        result.append(EnrolledStudentInfo(
            student_id=student.student_id,
            student_db_id=str(student.id),
            name=student.name,
            email=student.email,
            year=student.year,
            joined_at=enrollment.joined_at,
            attendance_status=attendance.status.value if attendance else None
        ))

    return result


@router.patch("/{class_id}/deactivate", response_model=ClassResponse)
def deactivate_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty)
):
    """Deactivate (soft-delete) a class."""
    class_obj = db.query(Class).filter(
        Class.id == class_id,
        Class.faculty_id == current_faculty.id
    ).first()

    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    class_obj.is_active = False
    db.commit()
    db.refresh(class_obj)
    return class_obj


@router.get("/stats")
def get_faculty_stats(
    db: Session = Depends(get_db),
    current_faculty=Depends(get_current_faculty),
):
    """Real counts for the faculty dashboard."""
    faculty_classes = db.query(Class).filter(
        Class.faculty_id == str(current_faculty.id),
        Class.is_active == True,
    ).all()

    total_classes = len(faculty_classes)
    class_ids = [c.id for c in faculty_classes]

    total_students = 0
    if class_ids:
        total_students = (
            db.query(func.count(func.distinct(ClassEnrollment.student_id)))
            .filter(ClassEnrollment.class_id.in_(class_ids))
            .scalar()
        ) or 0

    today = local_today_date(getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC")
    today_classes = sum(
        1 for c in faculty_classes
        if c.start_time and c.start_time.date() == today
    )

    return {
        "total_classes": total_classes,
        "total_students": total_students,
        "today_classes": today_classes,
    }
