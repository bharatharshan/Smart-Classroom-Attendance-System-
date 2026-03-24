from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List

from pydantic import BaseModel, Field
from typing import Optional as Opt

from app.database import get_db
from app.models.student import Student
from app.models.faculty import Faculty
from app.models.class_model import Class
from app.models.classroom import Classroom
from app.models.period import Period
from app.models.subject import Subject
from app.models.attendance import Attendance
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate, ClassroomResponse
from app.schemas.period import PeriodCreate, PeriodUpdate, PeriodResponse
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    today = date.today()
    tomorrow = today + timedelta(days=1)

    students_count = db.query(Student).filter(Student.is_active == True).count()
    faculty_count = db.query(Faculty).filter(Faculty.is_active == True).count()
    classes_today = (
        db.query(Class)
        .filter(
            Class.is_active == True,
            Class.start_time >= datetime.combine(today, datetime.min.time()),
            Class.start_time < datetime.combine(tomorrow, datetime.min.time()),
        )
        .count()
    )
    classrooms_count = db.query(Classroom).count()

    return {
        "students_count": students_count,
        "faculty_count": faculty_count,
        "classes_today": classes_today,
        "classrooms_count": classrooms_count,
    }


@router.get("/attendance-week-trend")
def get_admin_attendance_week_trend(db: Session = Depends(get_db)):
    """Attendance row counts per weekday (Mon–Fri) for the calendar week containing today (by session_date)."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)
    rows = (
        db.query(Attendance.session_date, func.count(Attendance.id))
        .filter(Attendance.session_date >= monday, Attendance.session_date <= friday)
        .group_by(Attendance.session_date)
        .all()
    )
    by_date = {r[0]: int(r[1]) for r in rows}
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    days = []
    for i, lab in enumerate(labels):
        d = monday + timedelta(days=i)
        days.append({"label": lab, "count": by_date.get(d, 0)})
    return {"week_start": monday.isoformat(), "days": days}


# ── Classroom CRUD (admin, no JWT required) ──────────────────────────

@router.get("/classrooms", response_model=List[ClassroomResponse])
def admin_list_classrooms(db: Session = Depends(get_db)):
    return db.query(Classroom).order_by(Classroom.room_id).all()


@router.post("/classrooms", response_model=ClassroomResponse, status_code=status.HTTP_201_CREATED)
def admin_create_classroom(data: ClassroomCreate, db: Session = Depends(get_db)):
    existing = db.query(Classroom).filter(Classroom.room_id == data.room_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Room ID '{data.room_id}' already exists")
    room = Classroom(
        room_id=data.room_id,
        room_name=data.room_name,
        latitude=data.latitude,
        longitude=data.longitude,
        allowed_radius=data.allowed_radius,
        room_slug=data.room_slug,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.put("/classrooms/{room_id}", response_model=ClassroomResponse)
def admin_update_classroom(room_id: str, data: ClassroomUpdate, db: Session = Depends(get_db)):
    room = db.query(Classroom).filter(Classroom.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if data.room_name is not None:
        room.room_name = data.room_name
    if data.latitude is not None:
        room.latitude = data.latitude
    if data.longitude is not None:
        room.longitude = data.longitude
    if data.allowed_radius is not None:
        room.allowed_radius = data.allowed_radius
    if data.room_slug is not None:
        room.room_slug = data.room_slug
    db.commit()
    db.refresh(room)
    return room


@router.delete("/classrooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_classroom(room_id: str, db: Session = Depends(get_db)):
    room = db.query(Classroom).filter(Classroom.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    db.delete(room)
    db.commit()


# ── Period CRUD (admin, no JWT required) ──────────────────────────────

@router.get("/periods", response_model=List[PeriodResponse])
def admin_list_periods(db: Session = Depends(get_db)):
    return db.query(Period).order_by(Period.sort_order).all()


@router.post("/periods", response_model=PeriodResponse, status_code=status.HTTP_201_CREATED)
def admin_create_period(data: PeriodCreate, db: Session = Depends(get_db)):
    existing = db.query(Period).filter(Period.period_id == data.period_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Period ID '{data.period_id}' already exists")
    period = Period(
        period_id=data.period_id,
        period_name=data.period_name,
        start_time=data.start_time,
        end_time=data.end_time,
        period_type=data.period_type,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.put("/periods/{period_id}", response_model=PeriodResponse)
def admin_update_period(period_id: str, data: PeriodUpdate, db: Session = Depends(get_db)):
    period = db.query(Period).filter(Period.period_id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    if data.period_name is not None:
        period.period_name = data.period_name
    if data.start_time is not None:
        period.start_time = data.start_time
    if data.end_time is not None:
        period.end_time = data.end_time
    if data.period_type is not None:
        period.period_type = data.period_type
    db.commit()
    db.refresh(period)
    return period


@router.delete("/periods/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_period(period_id: str, db: Session = Depends(get_db)):
    period = db.query(Period).filter(Period.period_id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")
    db.delete(period)
    db.commit()


@router.put("/periods-sync", response_model=List[PeriodResponse])
def admin_sync_periods(items: List[PeriodCreate], db: Session = Depends(get_db)):
    """Replace all periods with the provided list in one atomic operation."""
    db.query(Period).delete()
    db.flush()
    created = []
    for idx, item in enumerate(items):
        p = Period(
            period_id=item.period_id,
            period_name=item.period_name,
            start_time=item.start_time,
            end_time=item.end_time,
            period_type=item.period_type,
            sort_order=item.sort_order if item.sort_order else idx,
        )
        db.add(p)
        created.append(p)
    db.commit()
    for p in created:
        db.refresh(p)
    return created


# ── Subject CRUD (admin, no JWT required) ─────────────────────────────

@router.get("/subjects", response_model=List[SubjectResponse])
def admin_list_subjects(db: Session = Depends(get_db)):
    return db.query(Subject).order_by(Subject.subject_code).all()


@router.post("/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def admin_create_subject(data: SubjectCreate, db: Session = Depends(get_db)):
    existing = db.query(Subject).filter(Subject.subject_code == data.subject_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject code '{data.subject_code}' already exists")
    subj = Subject(
        subject_code=data.subject_code,
        subject_name=data.subject_name,
        course=data.course,
        semester=data.semester,
    )
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return subj


@router.put("/subjects/{subject_code}", response_model=SubjectResponse)
def admin_update_subject(subject_code: str, data: SubjectUpdate, db: Session = Depends(get_db)):
    subj = db.query(Subject).filter(Subject.subject_code == subject_code).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    if data.subject_name is not None:
        subj.subject_name = data.subject_name
    if data.course is not None:
        subj.course = data.course
    if data.semester is not None:
        subj.semester = data.semester
    db.commit()
    db.refresh(subj)
    return subj


@router.delete("/subjects/{subject_code}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_subject(subject_code: str, db: Session = Depends(get_db)):
    subj = db.query(Subject).filter(Subject.subject_code == subject_code).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subj)
    db.commit()


# ── Faculty Management (admin, no JWT required) ──────────────────────

class AdminFacultyResponse(BaseModel):
    id: str
    faculty_id: str
    name: str
    email: str
    department: Opt[str] = None
    designation: Opt[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminFacultyUpdate(BaseModel):
    name: Opt[str] = Field(None, max_length=100)
    email: Opt[str] = Field(None, max_length=100)
    department: Opt[str] = Field(None, max_length=100)
    is_active: Opt[bool] = None


@router.get("/faculty", response_model=List[AdminFacultyResponse])
def admin_list_faculty(db: Session = Depends(get_db)):
    rows = db.query(Faculty).order_by(Faculty.faculty_id).all()
    return [AdminFacultyResponse(
        id=str(f.id),
        faculty_id=f.faculty_id,
        name=f.name,
        email=f.email,
        department=f.department,
        designation=f.designation,
        is_active=f.is_active,
        created_at=f.created_at,
    ) for f in rows]


@router.put("/faculty/{faculty_id}", response_model=AdminFacultyResponse)
def admin_update_faculty(faculty_id: str, data: AdminFacultyUpdate, db: Session = Depends(get_db)):
    fac = db.query(Faculty).filter(Faculty.faculty_id == faculty_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Faculty not found")
    if data.name is not None:
        fac.name = data.name
    if data.email is not None:
        fac.email = data.email
    if data.department is not None:
        fac.department = data.department
    if data.is_active is not None:
        fac.is_active = data.is_active
    db.commit()
    db.refresh(fac)
    return AdminFacultyResponse(
        id=str(fac.id),
        faculty_id=fac.faculty_id,
        name=fac.name,
        email=fac.email,
        department=fac.department,
        designation=fac.designation,
        is_active=fac.is_active,
        created_at=fac.created_at,
    )


@router.patch("/faculty/{faculty_id}/toggle", response_model=AdminFacultyResponse)
def admin_toggle_faculty(faculty_id: str, db: Session = Depends(get_db)):
    fac = db.query(Faculty).filter(Faculty.faculty_id == faculty_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Faculty not found")
    fac.is_active = not fac.is_active
    db.commit()
    db.refresh(fac)
    return AdminFacultyResponse(
        id=str(fac.id),
        faculty_id=fac.faculty_id,
        name=fac.name,
        email=fac.email,
        department=fac.department,
        designation=fac.designation,
        is_active=fac.is_active,
        created_at=fac.created_at,
    )


@router.delete("/faculty/{faculty_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_faculty(faculty_id: str, db: Session = Depends(get_db)):
    fac = db.query(Faculty).filter(Faculty.faculty_id == faculty_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Faculty not found")
    db.delete(fac)
    db.commit()