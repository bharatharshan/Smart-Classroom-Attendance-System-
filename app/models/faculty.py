from sqlalchemy import Column, String, Boolean, DateTime, Text
from app.database import Base
import uuid
from datetime import datetime


class Faculty(Base):
    """Faculty model for storing faculty information"""
    
    __tablename__ = "faculty"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    faculty_id = Column(String(50), unique=True, nullable=False, index=True)  # Faculty ID like FAC001
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)  # Professor, Assistant Professor, etc.
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships will be added when Timetable and Class models are properly defined
    # timetables = relationship("Timetable", back_populates="faculty", cascade="all, delete-orphan")
    # classes = relationship("Class", back_populates="faculty", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Faculty {self.faculty_id} - {self.name}>"
