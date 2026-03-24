from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime
from app.database import get_db
from app.models.location_ping import LocationPing, MovementStatus
from app.models.attendance import Attendance, AttendanceStatus
from app.models.class_model import Class
from app.models.student import Student
from app.schemas.location_ping import LocationPingCreate, LocationPingResponse, LocationPingDetail
from app.utils.dependencies import get_current_student
from app.utils.geofence import get_distance_info
from app.utils.movement import detect_movement, calculate_next_ping_interval
from app.utils.confidence import calculate_confidence_score

router = APIRouter(prefix="/attendance", tags=["Location Pinging"])


@router.post("/ping", response_model=LocationPingResponse)
def submit_location_ping(
    ping_data: LocationPingCreate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Submit a periodic location ping during class (Phase 4).
    
    - Validates geofence
    - Detects movement (STATIONARY vs MOVING)
    - Adjusts ping frequency adaptively
    - Updates confidence score
    - Auto-exits if outside geofence for 3+ consecutive pings
    """
    # 1. Get attendance record
    attendance = db.query(Attendance).filter(
        Attendance.id == ping_data.attendance_id
    ).first()
    
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found"
        )
    
    # 2. Check if attendance is still in progress
    if attendance.status != AttendanceStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Attendance is not in progress (status: {attendance.status.value})"
        )
    
    # 3. Get class details
    class_obj = db.query(Class).filter(Class.id == attendance.class_id).first()
    
    if not class_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # 4. Validate geofence
    distance_info = get_distance_info(
        ping_data.latitude,
        ping_data.longitude,
        class_obj.latitude,
        class_obj.longitude,
        class_obj.radius
    )
    
    # 5. Detect movement (compare with last ping)
    last_ping = db.query(LocationPing).filter(
        LocationPing.attendance_id == attendance.id
    ).order_by(LocationPing.timestamp.desc()).first()
    
    movement_status = MovementStatus.STATIONARY
    if last_ping:
        time_diff = (datetime.utcnow() - last_ping.timestamp).total_seconds()
        
        if time_diff > 0:
            movement_info = detect_movement(
                last_ping.latitude,
                last_ping.longitude,
                ping_data.latitude,
                ping_data.longitude,
                time_diff
            )
            
            movement_status = MovementStatus.MOVING if movement_info["status"] == "MOVING" else MovementStatus.STATIONARY
            
            if movement_status == MovementStatus.MOVING:
                attendance.movement_detected = True
    
    # 6. Create location ping record
    new_ping = LocationPing(
        attendance_id=attendance.id,
        latitude=ping_data.latitude,
        longitude=ping_data.longitude,
        timestamp=datetime.utcnow(),
        distance_from_class=distance_info["distance_meters"],
        is_inside_geofence=distance_info["inside_geofence"],
        movement_status=movement_status,
        wifi_ssid=ping_data.wifi_ssid,
        wifi_bssid=ping_data.wifi_bssid
    )
    
    db.add(new_ping)
    
    # 7. Update attendance statistics
    attendance.total_pings += 1
    if distance_info["inside_geofence"]:
        attendance.inside_geofence_pings += 1
    else:
        attendance.outside_geofence_pings += 1
    
    # 8. Auto-exit logic: if outside geofence for 3+ consecutive pings
    if attendance.outside_geofence_pings >= 3 and not attendance.auto_exited:
        # Check if last 3 pings were all outside
        recent_pings = db.query(LocationPing).filter(
            LocationPing.attendance_id == attendance.id
        ).order_by(LocationPing.timestamp.desc()).limit(3).all()
        
        all_outside = all(not ping.is_inside_geofence for ping in recent_pings)
        
        if all_outside:
            # Auto-exit
            attendance.exit_time = datetime.utcnow()
            attendance.auto_exited = True
            
            # Calculate duration
            if attendance.entry_time:
                duration = (attendance.exit_time - attendance.entry_time).total_seconds() / 60
                attendance.duration_minutes = int(duration)
                
                # Apply 75% rule
                class_duration = (class_obj.end_time - class_obj.start_time).total_seconds() / 60
                required_duration = class_duration * 0.75
                
                if attendance.duration_minutes >= required_duration:
                    attendance.status = AttendanceStatus.PRESENT
                else:
                    attendance.status = AttendanceStatus.ABSENT
            else:
                attendance.status = AttendanceStatus.ABSENT
    
    # 9. Calculate confidence score
    all_pings = db.query(LocationPing).filter(
        LocationPing.attendance_id == attendance.id
    ).all()
    
    attendance.confidence_score = calculate_confidence_score(attendance, all_pings)
    
    db.commit()
    db.refresh(new_ping)
    
    # 10. Calculate next ping interval (adaptive)
    next_ping_interval = calculate_next_ping_interval(
        movement_status.value,
        distance_info["inside_geofence"]
    )
    
    # 11. Generate response message
    if distance_info["inside_geofence"]:
        message = f"✅ Inside geofence ({distance_info['distance_meters']}m from classroom)"
    else:
        message = f"⚠️ Outside geofence ({distance_info['distance_meters']}m from classroom)"
    
    if attendance.auto_exited:
        message += " | Auto-exited due to leaving geofence"
    
    return LocationPingResponse(
        id=new_ping.id,
        distance_from_class=distance_info["distance_meters"],
        is_inside_geofence=distance_info["inside_geofence"],
        movement_status=movement_status,
        recommended_next_ping_seconds=next_ping_interval,
        confidence_score=attendance.confidence_score,
        total_pings=attendance.total_pings,
        message=message
    )


@router.get("/pings/{attendance_id}", response_model=List[LocationPingDetail])
def get_location_pings(
    attendance_id: UUID,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student)
):
    """
    Get all location pings for a specific attendance record.
    
    Useful for analyzing movement patterns and attendance behavior.
    """
    # Verify attendance exists
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found"
        )
    
    # Get all pings
    pings = db.query(LocationPing).filter(
        LocationPing.attendance_id == attendance_id
    ).order_by(LocationPing.timestamp.asc()).all()
    
    return pings
