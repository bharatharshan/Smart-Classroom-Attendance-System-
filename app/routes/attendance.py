from fastapi import APIRouter, Depends, HTTPException, status, Form, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from uuid import UUID
from datetime import datetime, timedelta
import logging
from app.database import get_db
from app.models.attendance import Attendance, AttendanceStatus
from app.models.student import Student
from app.models.class_model import Class
from app.models.enrollment import ClassEnrollment
from app.models.classroom import Classroom
from app.schemas.attendance import (
    AttendanceEntry,
    AttendanceExit,
    AttendanceResponse,
    AttendanceValidationSummary,
    BackgroundValidationResult,
    SessionVerifyRequest,
    MarkAttendanceRequest,
    AttendanceWindowResponse,
)
from app.utils.dependencies import get_current_student
from app.utils.geofence import is_inside_geofence, get_distance_info
from app.utils.face_recognition import verify_face
from app.services.geolocation_service import verify_geolocation
# Temporarily disabled due to installation issues
# from app.services.face_recognition_service import face_recognition_service
from app.config import settings
from app.utils.client_ip import get_client_ip
from app.services.room_network import ip_matches_room, default_room_slug
from app.utils.attendance_day import local_today_date
from app.utils.attendance_session import get_attendance_for_today_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attendance", tags=["Attendance"])

# Time-based rules: 0-5 min = Present, 5-10 min = Late, >10 min = Closed (Absent)
PRESENT_WINDOW_MINUTES = 5
LATE_WINDOW_MINUTES = 10  # window closes after 10 min

# TESTING FLAG:
# When set to True, the attendance window helper will always return
# a 'present' window so that marking attendance can be tested at any time
# without changing class start times or period definitions.
TEST_ALWAYS_OPEN = False


def _normalize_class_time_to_today(dt):
    """Ensure a class start/end datetime uses today's date, preserving only hour:minute."""
    from datetime import date as _date
    today = _date.today()
    if dt.date() != today:
        return dt.replace(year=today.year, month=today.month, day=today.day)
    return dt


def _get_attendance_window_and_status(class_start_time):
    """Returns (window, status_for_mark). window: 'present'|'late'|'closed'|'not_started'. status_for_mark: PRESENT|LATE|None.
    Uses server local time to match Class.start_time from timetable sync (naive local)."""
    if TEST_ALWAYS_OPEN:
        return "present", AttendanceStatus.PRESENT
    now = datetime.now()
    start = _normalize_class_time_to_today(class_start_time)
    if getattr(start, "tzinfo", None):
        start = start.replace(tzinfo=None)
    if getattr(now, "tzinfo", None):
        now = now.replace(tzinfo=None)
    delta = now - start
    minutes = delta.total_seconds() / 60.0
    if minutes < 0:
        return "not_started", None
    if minutes <= PRESENT_WINDOW_MINUTES:
        return "present", AttendanceStatus.PRESENT
    if minutes <= LATE_WINDOW_MINUTES:
        return "late", AttendanceStatus.LATE
    return "closed", None


@router.get("/window", response_model=AttendanceWindowResponse)
def get_attendance_window(
    class_id: str = Query(...),
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Get current attendance window for a class: present (0-5 min), late (5-10 min), or closed (>10 min).
    Used by frontend for countdown and to enable/disable the mark button.
    """
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    window, _ = _get_attendance_window_and_status(class_obj.start_time)
    now = datetime.now()
    start = class_obj.start_time
    if getattr(start, "tzinfo", None):
        start = start.replace(tzinfo=None)
    close_time = start + timedelta(minutes=LATE_WINDOW_MINUTES)
    seconds_remaining = max(0, int((close_time - now).total_seconds())) if window in ("present", "late") else 0
    messages = {
        "present": "Present window (0–5 min). Mark now for Present.",
        "late": "Late window (5–10 min). Mark now for Late.",
        "closed": "Attendance closed. You will be marked Absent.",
        "not_started": "Class has not started yet.",
    }
    return AttendanceWindowResponse(
        window=window,
        class_start_time=class_obj.start_time,
        seconds_remaining=seconds_remaining if window in ("present", "late") else None,
        message=messages.get(window, ""),
    )


@router.post("/mark", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def mark_attendance_time_based(
    request: Request,
    body: MarkAttendanceRequest,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Time-based attendance: geo + optional IP confidence + liveness + face (if enabled).
    0-5 min → Present, 5-10 min → Late. IP mismatch never rejects alone.
    """
    class_obj = db.query(Class).filter(Class.id == body.class_id).first()
    if not class_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if not class_obj.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class is not active")

    window, status_to_set = _get_attendance_window_and_status(class_obj.start_time)
    if window == "not_started":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class has not started yet. You cannot mark attendance before the start time.",
        )
    if window == "closed" or status_to_set is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance window has closed (after 10 minutes). You will be marked Absent.",
        )

    # Enrollment check
    enrollment = db.query(ClassEnrollment).filter(
        ClassEnrollment.student_id == current_student.id,
        ClassEnrollment.class_id == body.class_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You must enroll in this class first.")

    tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    session_today = local_today_date(tz)

    # Duplicate: one mark per student per class per calendar day (slot recurs weekly with same class_id)
    existing = get_attendance_for_today_session(db, current_student.id, body.class_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance already marked for this class today.",
        )

    # Resolve room slug for WiFi subnet + reference images (scalable per classroom)
    room_slug = body.room_slug
    linked_room = None
    if class_obj.room_id:
        linked_room = db.query(Classroom).filter(Classroom.id == class_obj.room_id).first()
        if linked_room and linked_room.room_slug:
            room_slug = linked_room.room_slug
    if not room_slug:
        room_slug = default_room_slug()

    client_ip = get_client_ip(request)
    ip_verified_flag = False
    if getattr(settings, "ip_validation_enabled", True):
        ip_verified_flag = ip_matches_room(client_ip, room_slug)

    # Location verification (required)
    room_lat, room_lon = class_obj.latitude, class_obj.longitude
    radius_m = class_obj.radius or 100.0
    if linked_room:
        room_lat, room_lon = linked_room.latitude, linked_room.longitude
        radius_m = linked_room.allowed_radius or 100.0
    location_verified = False
    if room_lat is not None and room_lon is not None:
        distance_info = get_distance_info(
            body.latitude, body.longitude, room_lat, room_lon, radius_m
        )
        if not distance_info["inside_geofence"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You are outside the classroom. Move within {radius_m}m to mark attendance.",
            )
        location_verified = True

    # Location confidence: IP never blocks; boosts High vs Medium
    if location_verified and ip_verified_flag:
        location_confidence = "High"
    elif location_verified:
        location_confidence = "Medium"
    else:
        location_confidence = "Low"

    # Liveness (client MediaPipe): required when enabled
    if getattr(settings, "liveness_required", True) and not body.liveness_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Liveness check required: please blink and turn your head left/right on the camera step.",
        )

    # Face verification (when face recognition enabled)
    face_verified = False
    if getattr(settings, "face_recognition_enabled", False) and body.face_embedding:
        if not current_student.face_enrolled or not current_student.face_embedding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Face enrollment required. Enroll your face first.",
            )
        matched, similarity = verify_face(
            enrolled_embedding_json=current_student.face_embedding,
            probe_embedding=body.face_embedding,
            threshold=getattr(settings, "face_similarity_threshold", 0.8),
        )
        if not matched:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Face verification failed. Please ensure your face is clearly visible.",
            )
        face_verified = True
    elif body.face_embedding and current_student.face_enrolled and current_student.face_embedding:
        matched, _ = verify_face(
            enrolled_embedding_json=current_student.face_embedding,
            probe_embedding=body.face_embedding,
            threshold=getattr(settings, "face_similarity_threshold", 0.8),
        )
        face_verified = matched

    identity_ok = face_verified if settings.face_recognition_enabled else True
    liveness_ok = body.liveness_verified if settings.liveness_required else True
    if not identity_ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Identity verification failed. Face recognition is required for this action.",
        )
    if not (location_verified and liveness_ok and identity_ok):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attendance rejected: geolocation, liveness, and identity checks must all pass.",
        )

    validation_final = "Present"

    # Background validation (YOLOv8 + reference image similarity) — secondary signal
    bg_dict = None
    confidence_for_row = None
    if getattr(settings, "background_validation_enabled", True) and body.captured_image_base64:
        try:
            from app.services.background_validation import validate_from_base64

            bg_dict = validate_from_base64(
                body.captured_image_base64,
                room_slug,
                face_verified,
                location_verified,
                settings.face_recognition_enabled,
            )
            if bg_dict and bg_dict.get("combined_score") is not None:
                confidence_for_row = float(bg_dict["combined_score"])
        except Exception as bg_err:
            logger.warning("Background validation skipped due to error: %s", bg_err)
            bg_dict = None

    capture_time = datetime.utcnow()
    attendance = Attendance(
        student_id=current_student.id,
        class_id=UUID(body.class_id),
        entry_time=capture_time,
        capture_time=capture_time,
        session_date=session_today,
        status=status_to_set,
        face_verified=face_verified,
        location_verified=location_verified,
        confidence_score=confidence_for_row,
        client_ip=client_ip,
        ip_verified=ip_verified_flag,
        liveness_verified=body.liveness_verified,
        location_confidence=location_confidence,
    )
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    logger.info(f"Attendance marked {status_to_set.value}: {current_student.student_id} class {body.class_id}")
    out = AttendanceResponse.model_validate(attendance)
    val_summary = AttendanceValidationSummary(
        ip_address=client_ip,
        ip_verified=ip_verified_flag,
        liveness_verified=bool(body.liveness_verified),
        location_confidence=location_confidence,  # type: ignore[arg-type]
        final_status=validation_final,  # type: ignore[arg-type]
    )
    out = out.model_copy(update={"validation": val_summary, "confidence_score": confidence_for_row})
    if bg_dict:
        out = out.model_copy(
            update={
                "background_validation": BackgroundValidationResult(
                    detected_objects=bg_dict.get("detected_objects") or [],
                    similarity_score=float(bg_dict.get("similarity_score", 0.0)),
                    background_score=float(bg_dict.get("background_score", 0.0)),
                    final_status=str(bg_dict.get("final_status", "Rejected")),
                ),
                "confidence_score": confidence_for_row,
                "validation": val_summary,
            }
        )
    return out


@router.post("/entry-with-face", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def mark_attendance_with_face(
    image: str = Form(...),  # Base64 encoded image
    class_id: str = Form(...),
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    db: Session = Depends(get_db)
):
    """
    Mark attendance entry using face recognition.
    
    - Captures face from webcam
    - Verifies face against registered students
    - Marks attendance if face matches
    - Validates location within geofence
    """
    try:
        # Verify class exists
        class_obj = db.query(Class).filter(Class.id == class_id).first()
        if not class_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Class not found"
            )
        
        # Get all students with face encodings
        students = db.query(Student).filter(
            Student.face_enrolled == True,
            Student.face_embedding.isnot(None)
        ).all()
        
        if not students:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No registered faces found in system"
            )
        
        # Prepare student data for face recognition
        students_data = []
        for student in students:
            students_data.append({
                "id": student.id,
                "face_embedding": student.face_embedding
            })
        
        # Load known encodings
        # known_encodings, known_ids = face_recognition_service.load_known_encodings(students_data)
        # Temporarily disabled due to face_recognition installation issues
        known_encodings, known_ids = [], []
        
        if not known_encodings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Face recognition temporarily disabled - No valid face encodings found"
            )
        
        # Decode and process image
        # image_array = face_recognition_service.decode_base64_image(image)
        # Temporarily disabled
        image_array = None
        
        # Verify face
        # verification_result = face_recognition_service.verify_face(
        #     image_array, known_encodings, known_ids
        # )
        # Temporarily return mock result
        verification_result = {"verified": False, "student_id": None, "confidence": 0.0}
        
        if not verification_result["verified"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Face not recognized. Confidence: {verification_result.get('confidence', 0):.2f}"
            )
        
        # Get matched student
        matched_student = db.query(Student).filter(
            Student.id == verification_result["student_id"]
        ).first()
        
        if not matched_student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        # Check if attendance already exists for today's session
        existing_attendance = get_attendance_for_today_session(
            db, matched_student.id, class_id
        )
        
        if existing_attendance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attendance already marked for this student in this class"
            )
        
        # Validate location within geofence
        radius = getattr(class_obj, 'radius', None) or 100.0
        distance_info = get_distance_info(
            latitude, longitude,
            class_obj.latitude, class_obj.longitude,
            radius
        )
        is_inside = distance_info["inside_geofence"]

        if not is_inside:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Student is outside the classroom geofence. Distance: {distance_info['distance_meters']:.2f}m"
            )
        
        tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
        # Create attendance record
        attendance = Attendance(
            student_id=matched_student.id,
            class_id=class_id,
            entry_time=datetime.utcnow(),
            session_date=local_today_date(tz),
            status=AttendanceStatus.IN_PROGRESS,
            confidence_score=verification_result.get('confidence', 0.0)
        )
        
        db.add(attendance)
        db.commit()
        db.refresh(attendance)
        
        logger.info(f"Face recognition attendance marked: {matched_student.name} for class {class_id}")
        
        return attendance
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face recognition attendance error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark attendance with face recognition"
        )

@router.post("/entry", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def mark_attendance_entry(
    entry_data: AttendanceEntry,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Mark attendance entry for a student in a class.
    
    - Records entry_time
    - Sets status to IN_PROGRESS
    - Prevents duplicate entries for the same student-class combination
    - Validates student location is within classroom geofence (Phase 3)
    - Optionally validates 3D facial recognition embedding (Phase 5)
    """
    # Verify student exists
    student = db.query(Student).filter(Student.id == entry_data.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Verify class exists
    class_obj = db.query(Class).filter(Class.id == entry_data.class_id).first()
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Check if class is active
    if not class_obj.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class is not active"
        )
    
    # PHASE 3: Validate geofence (location-based attendance)
    # Use class's room if set, else class's own lat/lon/radius
    room_lat = class_obj.latitude
    room_lon = class_obj.longitude
    radius_m = class_obj.radius
    if class_obj.room_id and not (room_lat is not None and room_lon is not None):
        room = db.query(Classroom).filter(Classroom.id == class_obj.room_id).first()
        if room:
            room_lat, room_lon = room.latitude, room.longitude
            radius_m = room.allowed_radius if room.allowed_radius is not None else 100.0
    if radius_m is None:
        radius_m = 100.0  # default 100 meters per requirement

    if room_lat is not None and room_lon is not None:
        distance_info = get_distance_info(
            entry_data.latitude,
            entry_data.longitude,
            room_lat,
            room_lon,
            radius_m
        )
        
        if not distance_info["inside_geofence"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"You are outside the classroom geofence. "
                    f"You are {distance_info['distance_meters']}m away from the classroom. "
                    f"Please move within {radius_m}m to mark attendance."
                )
            )
    
    # Phase 5: Optional 3D facial verification
    if getattr(settings, "face_recognition_enabled", False):
        if not hasattr(entry_data, "face_embedding") or entry_data.face_embedding is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Facial recognition is enabled. face_embedding is required for entry.",
            )

        if not student.face_enrolled or not student.face_embedding:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No enrolled face template found for this student. Please enroll your face first.",
            )

        matched, similarity = verify_face(
            enrolled_embedding_json=student.face_embedding,
            probe_embedding=entry_data.face_embedding,
            threshold=settings.face_similarity_threshold,
        )

        if not matched:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Face verification failed. Please ensure your face is clearly visible.",
            )

    # Check student is enrolled in this class
    enrollment = db.query(ClassEnrollment).filter(
        ClassEnrollment.student_id == entry_data.student_id,
        ClassEnrollment.class_id == entry_data.class_id
    ).first()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must join this class before marking attendance."
        )

    # Check for existing attendance record for today's session (prevents duplicate entry)
    existing_attendance = get_attendance_for_today_session(
        db, entry_data.student_id, entry_data.class_id
    )
    
    if existing_attendance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance entry already exists for this student in this class"
        )
    
    tz = getattr(settings, "app_timezone", "Asia/Kolkata") or "UTC"
    # Create new attendance record and start session for adaptive pinging
    new_attendance = Attendance(
        student_id=entry_data.student_id,
        class_id=entry_data.class_id,
        entry_time=datetime.utcnow(),
        session_date=local_today_date(tz),
        status=AttendanceStatus.IN_PROGRESS,
        session_active=True,
        last_verified_at=datetime.utcnow(),
    )
    
    try:
        db.add(new_attendance)
        db.commit()
        db.refresh(new_attendance)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance entry already exists"
        )
    
    return new_attendance


@router.post("/exit", response_model=AttendanceResponse)
async def mark_attendance_exit(
    exit_data: AttendanceExit,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Mark attendance exit for a student in a class.
    
    - Records exit_time
    - Calculates duration
    - Updates status to PRESENT if duration >= 75% of class time, else ABSENT
    - Handles edge case: exit without entry
    - Validates location (Phase 3) - logs warning if outside geofence
    """
    # Find existing attendance record for today's session
    attendance = get_attendance_for_today_session(
        db, exit_data.student_id, exit_data.class_id
    )
    
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No attendance entry found. Please mark entry first."
        )
    
    # Check if exit already recorded
    if attendance.exit_time is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance exit already recorded"
        )
    
    # Get class details for duration calculation
    class_obj = db.query(Class).filter(Class.id == exit_data.class_id).first()
    
    # PHASE 3: Validate geofence at exit (informational only)
    # We allow exit even if outside geofence, but could flag for review
    if class_obj.latitude is not None and class_obj.longitude is not None and class_obj.radius is not None:
        distance_info = get_distance_info(
            exit_data.latitude,
            exit_data.longitude,
            class_obj.latitude,
            class_obj.longitude,
            class_obj.radius
        )
        
        if not distance_info["inside_geofence"]:
            # Log warning: Student is exiting from outside geofence
            # In production, this could be logged to a monitoring system
            # For now, we still allow the exit but could mark it for review
            print(f"WARNING: Student {exit_data.student_id} exiting from outside geofence "
                  f"({distance_info['distance_meters']}m away)")
    
    # Record exit time
    exit_time = datetime.utcnow()
    attendance.exit_time = exit_time
    
    # Calculate duration in minutes
    if attendance.entry_time:
        duration = (exit_time - attendance.entry_time).total_seconds() / 60
        attendance.duration_minutes = int(duration)
        
        # Calculate class duration in minutes
        class_duration = (class_obj.end_time - class_obj.start_time).total_seconds() / 60
        
        # Calculate required duration (75% of class time)
        required_duration = class_duration * 0.75
        
        # Update status based on duration
        if attendance.duration_minutes >= required_duration:
            attendance.status = AttendanceStatus.PRESENT
        else:
            attendance.status = AttendanceStatus.ABSENT
    else:
        # Edge case: exit without proper entry time
        attendance.status = AttendanceStatus.ABSENT
    
    db.commit()
    db.refresh(attendance)
    return attendance


@router.get("/student/{student_id}", response_model=List[AttendanceResponse])
def get_student_attendance(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Get attendance history for the current student only.
    Requires authentication.
    """
    if student_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own attendance history",
        )
    attendances = (
        db.query(Attendance)
        .filter(Attendance.student_id == current_student.id)
        .order_by(Attendance.created_at.desc())
        .all()
    )
    results = []
    for att in attendances:
        data = AttendanceResponse.model_validate(att)
        cls = db.query(Class).filter(Class.id == att.class_id).first()
        if cls:
            data.subject_name = cls.subject_name
        results.append(data)
    return results


@router.get("/class/{class_id}", response_model=List[AttendanceResponse])
def get_class_attendance(
    class_id: UUID,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Get attendance records for a specific class.

    Requires authentication. Useful for faculty to view class attendance.
    """
    # Verify class exists
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )

    # Get all attendance records for the class
    attendances = db.query(Attendance).filter(Attendance.class_id == class_id).all()

    return attendances


@router.get("/verify-geolocation")
def verify_geolocation_for_attendance(
    class_id: str = Query(...),
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Verify if current student's location is within the classroom geofence (Haversine).
    Returns verified, distance_meters, inside_geofence, allowed_radius_meters.
    """
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    room_lat = class_obj.latitude
    room_lon = class_obj.longitude
    radius_m = class_obj.radius
    if class_obj.room_id:
        room = db.query(Classroom).filter(Classroom.id == class_obj.room_id).first()
        if room:
            room_lat, room_lon = room.latitude, room.longitude
            radius_m = room.allowed_radius or 100.0
    if radius_m is None:
        radius_m = 100.0
    if room_lat is None or room_lon is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class has no geofence configured (no room or coordinates)",
        )
    result = verify_geolocation(latitude, longitude, room_lat, room_lon, radius_m)
    return result


@router.post("/session/verify")
def adaptive_ping_session_verify(
    body: SessionVerifyRequest,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Adaptive ping verification: student sends face capture again to confirm still present.
    If verification fails or student does not respond, session can be marked inactive/suspicious.
    """
    attendance = db.query(Attendance).filter(
        Attendance.id == body.attendance_id,
        Attendance.student_id == current_student.id,
    ).first()
    if not attendance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance session not found")
    if not attendance.session_active:
        return {
            "verified": False,
            "session_active": False,
            "message": "Session already marked inactive or suspicious.",
        }
    if not current_student.face_enrolled or not current_student.face_embedding:
        attendance.verification_failures += 1
        if attendance.verification_failures >= 3:
            attendance.session_active = False
            attendance.session_marked_suspicious_at = datetime.utcnow()
        db.commit()
        return {
            "verified": False,
            "session_active": attendance.session_active,
            "message": "No enrolled face to verify.",
        }
    matched, similarity = verify_face(
        enrolled_embedding_json=current_student.face_embedding,
        probe_embedding=body.face_embedding,
        threshold=getattr(settings, "face_similarity_threshold", 0.8),
    )
    if matched:
        attendance.last_verified_at = datetime.utcnow()
        attendance.verification_failures = 0
        db.commit()
        return {
            "verified": True,
            "session_active": True,
            "similarity": similarity,
            "message": "Session verified. You are still marked present.",
        }
    attendance.verification_failures += 1
    if attendance.verification_failures >= 3:
        attendance.session_active = False
        attendance.session_marked_suspicious_at = datetime.utcnow()
    db.commit()
    return {
        "verified": False,
        "session_active": attendance.session_active,
        "message": "Face verification failed. Respond to next ping to stay marked present.",
    }
