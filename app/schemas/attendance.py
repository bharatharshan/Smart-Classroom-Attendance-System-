from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List, Literal
from enum import Enum


class AttendanceStatus(str, Enum):
    """Attendance status enumeration"""
    IN_PROGRESS = "IN_PROGRESS"
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"


class MarkAttendanceRequest(BaseModel):
    """Request for POST /attendance/mark (time-based: Present/Late within 0-10 min)"""
    class_id: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    face_embedding: Optional[List[float]] = Field(default=None, min_length=16)
    # Optional JPEG/PNG as base64 or data URL — enables YOLO + room similarity scoring (does not reject on mismatch alone)
    captured_image_base64: Optional[str] = Field(default=None, description="Base64 or data URL of captured scene image")
    # Client-side MediaPipe liveness (blink + head turn); required when liveness_required is true
    liveness_verified: bool = Field(False, description="True only after blink AND head movement detected")
    # Optional override if class has no classroom linked; else taken from classroom.room_slug
    room_slug: Optional[str] = Field(None, max_length=50, description="Venue key for WiFi subnet + background refs (e.g. cosol3)")


class AttendanceValidationSummary(BaseModel):
    """Combined IP + liveness + geo confidence (IP never rejects alone)."""
    ip_address: str
    ip_verified: bool
    liveness_verified: bool
    location_confidence: Literal["High", "Medium", "Low"]
    final_status: Literal["Present", "Rejected"]


class BackgroundValidationResult(BaseModel):
    """Output of background validation (object detection + reference similarity)."""
    detected_objects: List[str] = Field(default_factory=list)
    similarity_score: float = Field(0.0, ge=0.0, le=1.0)
    background_score: float = Field(0.0, ge=0.0, le=1.0)
    final_status: str = Field(..., description='"Present" | "Present (Low Confidence)" | "Rejected"')


class AttendanceEntry(BaseModel):
    """Schema for marking attendance entry"""
    student_id: str
    class_id: str
    latitude: float = Field(..., ge=-90, le=90, description="Student's current latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Student's current longitude")
    # Phase 5: optional 3D face embedding sent from client when facial recognition is enabled
    face_embedding: Optional[List[float]] = Field(
        default=None,
        description="3D face embedding vector used for facial verification (Phase 5).",
        min_items=16,
    )


class AttendanceExit(BaseModel):
    """Schema for marking attendance exit"""
    student_id: str
    class_id: str
    latitude: float = Field(..., ge=-90, le=90, description="Student's current latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Student's current longitude")


class SessionVerifyRequest(BaseModel):
    """Schema for adaptive ping session verification"""
    attendance_id: str
    face_embedding: List[float] = Field(..., min_length=16)


class AttendanceWindowResponse(BaseModel):
    """Window state for time-based attendance (0-5 Present, 5-10 Late, >10 Closed)"""
    window: str  # "present" | "late" | "closed" | "not_started"
    class_start_time: Optional[datetime] = None
    seconds_remaining: Optional[int] = None  # until window closes (10 min after start)
    message: str = ""


class AttendanceResponse(BaseModel):
    """Schema for attendance response"""
    id: str
    student_id: str
    class_id: str
    subject_name: Optional[str] = None
    entry_time: Optional[datetime]
    exit_time: Optional[datetime]
    capture_time: Optional[datetime] = None
    status: AttendanceStatus
    face_verified: bool = False
    location_verified: bool = False
    confidence_score: Optional[float]
    background_validation: Optional[BackgroundValidationResult] = None
    validation: Optional[AttendanceValidationSummary] = None
    total_pings: Optional[int]
    inside_geofence_pings: Optional[int]
    outside_geofence_pings: Optional[int]
    duration_minutes: Optional[int]
    created_at: datetime

    # Phase 4 fields
    movement_detected: bool = False
    auto_exited: bool = False

    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', 'student_id', 'class_id', mode='before')
    @classmethod
    def coerce_uuid_fields(cls, v):
        return str(v) if v is not None else v
