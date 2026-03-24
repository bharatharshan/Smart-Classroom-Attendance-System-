import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Student(Base):
    """Student model for storing student information"""
    
    __tablename__ = "students"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String(50), unique=True, nullable=False, index=True)  # Roll number
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    year = Column(String(20), nullable=True)  # e.g., "1MCA-A", "6MCA-B"
    is_active = Column(Boolean, default=True)

    # Phase 5: 3D facial recognition enrollment
    # Stored as JSON-encoded list of floats representing a 3D embedding vector
    face_embedding = Column(Text, nullable=True)
    face_embedding_model = Column(String(100), nullable=True)
    face_enrolled = Column(Boolean, default=False)
    # Optional base64-encoded profile photo captured/ uploaded during registration
    profile_photo = Column(Text, nullable=True)

    # Browser push: student has granted notification permission
    notification_enabled = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    attendances = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")
    enrollments = relationship("ClassEnrollment", back_populates="student", cascade="all, delete-orphan")

    
    def __repr__(self):
        return f"<Student {self.student_id} - {self.name}>"
