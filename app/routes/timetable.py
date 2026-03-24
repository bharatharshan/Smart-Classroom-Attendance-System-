from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.faculty import Faculty
from app.models.class_model import Class
from app.models.timetable import Timetable, DAYS
from app.models.classroom import Classroom
from app.models.period import Period
from app.schemas.timetable import TimetableCreate, TimetableUpdate, TimetableResponse, TimetableTemplate
from app.utils.faculty_dependencies import get_current_faculty
from typing import List
from datetime import datetime, date

router = APIRouter(prefix="/faculty/timetable", tags=["Faculty Timetable"])


def _get_period_times(db: Session):
    """Build period_id → (start_h, start_m, end_h, end_m) from the periods table."""
    periods = db.query(Period).filter(Period.period_type == "class").all()
    mapping = {}
    for p in periods:
        try:
            sh, sm = [int(x) for x in p.start_time.split(":")]
            eh, em = [int(x) for x in p.end_time.split(":")]
            mapping[p.period_id] = (sh, sm, eh, em)
        except (ValueError, AttributeError):
            pass
    return mapping


def _get_all_period_ids(db: Session):
    """Get all period_ids from the database (class + break)."""
    return [p.period_id for p in db.query(Period).order_by(Period.sort_order).all()]


def _sync_classes_from_timetable(
    faculty_id: str,
    faculty_name: str,
    timetable_data: dict,
    db: Session
):
    """
    Keep the `classes` table in sync with the timetable data.
    Reads period times dynamically from the periods table.
    """
    today = date.today()
    fid_short = str(faculty_id)[:8]
    period_times = _get_period_times(db)

    for day in DAYS:
        day_data = timetable_data.get(day, {})
        day3 = day[:3]

        for period_key, slot in day_data.items():
            if not isinstance(slot, dict):
                continue
            if slot.get("is_break"):
                continue

            subject    = (slot.get("subject")    or "").strip()
            class_name = (slot.get("class_name") or "").strip()

            stable_code = f"{fid_short}_{day3}_{period_key}"

            existing: Class = db.query(Class).filter(
                Class.class_code == stable_code
            ).first()

            if subject and class_name:
                times = period_times.get(period_key)
                if times is None:
                    continue
                sh, sm, eh, em = times
                start_dt = datetime(today.year, today.month, today.day, sh, sm)
                end_dt   = datetime(today.year, today.month, today.day, eh, em)

                room_id_uuid = None
                lat, lon, rad = None, None, None
                room_id_str = slot.get("room_id")
                if room_id_str:
                    try:
                        from uuid import UUID
                        room_id_uuid = UUID(room_id_str)
                        room = db.query(Classroom).filter(Classroom.id == room_id_uuid).first()
                        if room:
                            lat, lon = room.latitude, room.longitude
                            rad = room.allowed_radius or 100.0
                    except (ValueError, TypeError):
                        pass

                if existing:
                    existing.subject_name = subject
                    existing.faculty_name = faculty_name
                    existing.batch        = class_name
                    existing.start_time   = start_dt
                    existing.end_time     = end_dt
                    existing.is_active    = True
                    if room_id_uuid is not None:
                        existing.room_id = room_id_uuid
                        existing.latitude = lat
                        existing.longitude = lon
                        existing.radius = rad
                else:
                    db.add(Class(
                        class_code   = stable_code,
                        subject_name = subject,
                        subject_code = None,
                        faculty_name = faculty_name,
                        faculty_id   = str(faculty_id),
                        batch        = class_name,
                        start_time   = start_dt,
                        end_time     = end_dt,
                        room_id      = room_id_uuid,
                        latitude     = lat,
                        longitude    = lon,
                        radius       = rad,
                    ))
            else:
                if existing:
                    existing.is_active = False

    db.commit()


@router.get("/template", response_model=TimetableTemplate)
def get_timetable_template():
    """Get the default timetable template with periods and days."""
    return TimetableTemplate.get_default_template()


@router.post("/create", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
def create_timetable(
    timetable_data: TimetableCreate,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty)
):
    """
    Create a new timetable for the faculty and auto-create Class records for
    every filled slot.
    """
    existing_timetable = db.query(Timetable).filter(
        Timetable.faculty_id == current_faculty.id,
        Timetable.academic_year == timetable_data.academic_year,
        Timetable.semester == timetable_data.semester,
        Timetable.is_active == True
    ).first()

    if existing_timetable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Active timetable already exists for {timetable_data.academic_year} - {timetable_data.semester}"
        )

    _validate_timetable_structure(timetable_data.timetable_data.dict())

    new_timetable = Timetable(
        faculty_id     = current_faculty.id,
        timetable_data = timetable_data.timetable_data.dict(),
        academic_year  = timetable_data.academic_year,
        semester       = timetable_data.semester
    )
    db.add(new_timetable)
    db.commit()
    db.refresh(new_timetable)

    # ── Auto-create Class rows from every filled slot ──
    try:
        _sync_classes_from_timetable(
            faculty_id=str(current_faculty.id),
            faculty_name=current_faculty.name,
            timetable_data=new_timetable.timetable_data,
            db=db,
        )
    except Exception as sync_err:
        # Class sync is best-effort; timetable is already saved
        import logging
        logging.getLogger(__name__).warning(f"Class sync failed: {sync_err}")

    return TimetableResponse.from_orm(new_timetable)


@router.get("/my-timetables", response_model=List[TimetableResponse])
def get_my_timetables(
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty)
):
    """Get all timetables for the current faculty."""
    timetables = db.query(Timetable).filter(
        Timetable.faculty_id == current_faculty.id
    ).order_by(Timetable.created_at.desc()).all()
    return [TimetableResponse.from_orm(t) for t in timetables]


@router.get("/active", response_model=TimetableResponse)
def get_active_timetable(
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty)
):
    """Get the active timetable for the current faculty."""
    timetable = db.query(Timetable).filter(
        Timetable.faculty_id == current_faculty.id,
        Timetable.is_active == True
    ).order_by(Timetable.created_at.desc()).first()

    if not timetable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active timetable found. Please create a timetable first."
        )
    return TimetableResponse.from_orm(timetable)


@router.put("/update/{timetable_id}", response_model=TimetableResponse)
def update_timetable(
    timetable_id: str,
    timetable_update: TimetableUpdate,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty)
):
    """
    Update an existing timetable and sync Class rows to match the new slot data.
    """
    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id,
        Timetable.faculty_id == current_faculty.id
    ).first()

    if not timetable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable not found")

    _validate_timetable_structure(timetable_update.timetable_data.dict())

    timetable.timetable_data = timetable_update.timetable_data.dict()
    if timetable_update.academic_year:
        timetable.academic_year = timetable_update.academic_year
    if timetable_update.semester:
        timetable.semester = timetable_update.semester

    db.commit()
    db.refresh(timetable)

    # ── Sync Class rows to match updated slots ──
    try:
        _sync_classes_from_timetable(
            faculty_id=str(current_faculty.id),
            faculty_name=current_faculty.name,
            timetable_data=timetable.timetable_data,
            db=db,
        )
    except Exception as sync_err:
        import logging
        logging.getLogger(__name__).warning(f"Class sync failed: {sync_err}")

    return TimetableResponse.from_orm(timetable)


@router.delete("/delete/{timetable_id}")
def delete_timetable(
    timetable_id: str,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty)
):
    """Soft-delete a timetable."""
    timetable = db.query(Timetable).filter(
        Timetable.id == timetable_id,
        Timetable.faculty_id == current_faculty.id
    ).first()

    if not timetable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable not found")

    timetable.is_active = False
    db.commit()
    return {"message": "Timetable deleted successfully"}


def _validate_timetable_structure(timetable_data: dict):
    """Validate the structure of timetable data — just check all 5 days exist."""
    for day in DAYS:
        if day not in timetable_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing day: {day}"
            )
