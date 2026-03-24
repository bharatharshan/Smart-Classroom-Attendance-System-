import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Class(Base):
    """Class model for storing class/lecture information"""
    
    __tablename__ = "classes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_code = Column(String(50), unique=True, nullable=False, index=True)
    subject_name = Column(String(100), nullable=False)
    subject_code = Column(String(50), nullable=True)
    faculty_name = Column(String(100), nullable=False)

    # Which faculty owns this class
    faculty_id = Column(String(36), ForeignKey("faculty.id", ondelete="SET NULL"), nullable=True, index=True)

    # Which student batch this class is for, e.g. "6MCA-A", "1MCA-B"
    batch = Column(String(20), nullable=True, index=True)

    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    # Optional: link to classroom for geo; if set, use room's coordinates for geofence
    room_id = Column(UUID(as_uuid=True), ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Geofence parameters (for Phase 3); can be set from Classroom or manually
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius = Column(Float, nullable=True)  # in meters
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    attendances = relationship("Attendance", back_populates="class_obj", cascade="all, delete-orphan")
    enrollments = relationship("ClassEnrollment", back_populates="class_obj", cascade="all, delete-orphan")
    classroom = relationship("Classroom", backref="classes")
    
    def __repr__(self):
        return f"<Class {self.class_code} - {self.subject_name} [{self.batch}]>"
