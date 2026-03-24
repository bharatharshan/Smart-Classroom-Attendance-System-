import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Date, Integer, ForeignKey, Enum, UniqueConstraint, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class AttendanceStatus(enum.Enum):
    """Attendance status enumeration"""
    IN_PROGRESS = "IN_PROGRESS"
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"


class Attendance(Base):
    """Attendance model for tracking student attendance in class"""
    
    __tablename__ = "attendances"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False)
    
    entry_time = Column(DateTime, nullable=True)
    exit_time = Column(DateTime, nullable=True)
    capture_time = Column(DateTime, nullable=True)  # when student submitted (present/late) or when marked absent
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT)
    face_verified = Column(Boolean, default=False)
    location_verified = Column(Boolean, default=False)
    confidence_score = Column(Float, nullable=True)
    total_pings = Column(Integer, default=0)
    inside_geofence_pings = Column(Integer, default=0)
    outside_geofence_pings = Column(Integer, default=0)
    duration_minutes = Column(Integer, nullable=True)
    movement_detected = Column(Boolean, default=False)
    auto_exited = Column(Boolean, default=False)

    # Adaptive ping session: track if student is still present
    session_active = Column(Boolean, default=True)
    last_verified_at = Column(DateTime, nullable=True)
    verification_failures = Column(Integer, default=0)
    session_marked_suspicious_at = Column(DateTime, nullable=True)

    # Extended validation (liveness + IP confidence)
    client_ip = Column(String(45), nullable=True)
    ip_verified = Column(Boolean, nullable=True)
    liveness_verified = Column(Boolean, nullable=True)
    location_confidence = Column(String(10), nullable=True)  # High | Medium | Low

    # Calendar session (app timezone) — same class_id recurs weekly; one row per student per class per day
    session_date = Column(Date, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    student = relationship("Student", back_populates="attendances")
    class_obj = relationship("Class", back_populates="attendances")
    location_pings = relationship("LocationPing", back_populates="attendance", cascade="all, delete-orphan")
    
    # One attendance per student per class per calendar day (recurring weekly slots share class_id)
    __table_args__ = (
        UniqueConstraint('student_id', 'class_id', 'session_date', name='unique_student_class_session'),
    )
    
    def __repr__(self):
        return f"<Attendance {self.student_id} - {self.class_id} - {self.status.value}>"
