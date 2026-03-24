from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime
from app.config import settings
from app.database import get_db
from app.utils.attendance_day import local_today_date, local_weekday_abbr
from app.models.class_model import Class
from app.models.student import Student
from app.models.enrollment import ClassEnrollment
from app.models.attendance import Attendance
from app.models.period import Period
from app.utils.attendance_session import get_attendance_for_today_session
from app.schemas.class_schema import ClassCreate, ClassResponse, ClassWithEnrollment
from app.schemas.enrollment import EnrollmentResponse
from app.utils.dependencies import get_current_student

router = APIRouter(prefix="/classes", tags=["Classes"])


def _refresh_class_dates_to_today(classes, db: Session):
    """
    If a class's start_time is not today, update it (and end_time) to today
    using the period times from the DB, so attendance windows stay accurate.
    """
    tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    today = local_today_date(tz)
    period_map = {}
    for p in db.query(Period).filter(Period.period_type == "class").all():
        try:
            sh, sm = [int(x) for x in p.start_time.split(":")]
            eh, em = [int(x) for x in p.end_time.split(":")]
            period_map[p.period_id] = (sh, sm, eh, em)
        except (ValueError, AttributeError):
            pass

    dirty = False
    for cls in classes:
        if cls.start_time.date() == today:
            continue
        parts = cls.class_code.rsplit("_", 1)
        period_id = parts[-1] if len(parts) >= 2 else None
        if period_id and period_id in period_map:
            sh, sm, eh, em = period_map[period_id]
            cls.start_time = datetime(today.year, today.month, today.day, sh, sm)
            cls.end_time = datetime(today.year, today.month, today.day, eh, em)
            dirty = True
        else:
            cls.start_time = cls.start_time.replace(
                year=today.year, month=today.month, day=today.day
            )
            cls.end_time = cls.end_time.replace(
                year=today.year, month=today.month, day=today.day
            )
            dirty = True
    if dirty:
        db.commit()


@router.get("/my-batch", response_model=List[ClassWithEnrollment])
def get_my_batch_classes(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Return active classes for today only, matching the student's batch.
    Classes are identified by class_code which contains the day (e.g. abc_Mon_P1).
    Attendance is checked for today only so previous days don't show as "marked".
    """
    student_batch = current_student.year
    if not student_batch:
        return []

    tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    today_day3 = local_weekday_abbr(tz)

    classes = db.query(Class).filter(
        Class.batch == student_batch,
        Class.is_active == True,
        Class.class_code.like(f"%_{today_day3}_%"),
    ).order_by(Class.start_time.asc()).all()

    _refresh_class_dates_to_today(classes, db)

    result = []
    for cls in classes:
        enrollment = db.query(ClassEnrollment).filter(
            ClassEnrollment.student_id == current_student.id,
            ClassEnrollment.class_id == cls.id
        ).first()

        attendance = get_attendance_for_today_session(
            db, current_student.id, cls.id
        )

        enrolled_count = db.query(ClassEnrollment).filter(
            ClassEnrollment.class_id == cls.id
        ).count()

        item = ClassWithEnrollment(
            id=str(cls.id),
            class_code=cls.class_code,
            subject_name=cls.subject_name,
            subject_code=cls.subject_code,
            faculty_name=cls.faculty_name,
            faculty_id=str(cls.faculty_id) if cls.faculty_id else None,
            batch=cls.batch,
            start_time=cls.start_time,
            end_time=cls.end_time,
            latitude=cls.latitude,
            longitude=cls.longitude,
            radius=cls.radius,
            is_active=cls.is_active,
            created_at=cls.created_at,
            enrolled=enrollment is not None,
            attendance_marked=attendance is not None,
            enrolled_count=enrolled_count
        )
        result.append(item)

    return result


@router.post("/{class_id}/enroll", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def enroll_in_class(
    class_id: str,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Student joins (enrolls in) a class.
    - Checks the class exists and matches their batch
    - Idempotent: if already enrolled, returns existing enrollment
    """
    class_obj = db.query(Class).filter(Class.id == class_id, Class.is_active == True).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    # Check batch match
    if class_obj.batch and current_student.year != class_obj.batch:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This class is for batch {class_obj.batch}. You are in {current_student.year}."
        )

    # Check already enrolled (idempotent)
    existing = db.query(ClassEnrollment).filter(
        ClassEnrollment.student_id == current_student.id,
        ClassEnrollment.class_id == class_id
    ).first()
    if existing:
        return existing

    enrollment = ClassEnrollment(
        student_id=current_student.id,
        class_id=class_id
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.get("", response_model=List[ClassResponse])
def list_classes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all active classes (unfiltered, for admin/legacy use)."""
    classes = db.query(Class).filter(Class.is_active == True).offset(skip).limit(limit).all()
    return classes


@router.get("/{class_id}", response_model=ClassResponse)
def get_class(class_id: str, db: Session = Depends(get_db)):
    """Get details of a specific class by ID."""
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=404, detail="Class not found")
    return class_obj
