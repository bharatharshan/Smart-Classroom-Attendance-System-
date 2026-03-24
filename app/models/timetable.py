from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON
from app.database import Base
import uuid
from datetime import datetime


class Timetable(Base):
    """Timetable model for storing faculty weekly schedule"""
    
    __tablename__ = "timetables"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    faculty_id = Column(String(36), ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False)
    
    # Store timetable as JSON - 5 days x 9 periods grid
    # Structure: {"Monday": {"P1": {"subject": "Math", "class": "6MCA A"}, ...}, ...}
    timetable_data = Column(JSON, nullable=False)
    
    # Academic session info
    academic_year = Column(String(20), nullable=False, default="2025-2026")
    semester = Column(String(20), nullable=False, default="Odd")
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship will be added when Faculty model is properly imported
    # faculty = relationship("Faculty", back_populates="timetables")
    
    def __repr__(self):
        return f"<Timetable {self.faculty_id} - {self.academic_year}>"


# Fixed period structure (P10 added for testing)
PERIODS = {
    "P1": {"time": "7:30 – 8:15", "duration": 45},
    "P2": {"time": "8:15 – 9:00", "duration": 45},
    "P3": {"time": "9:00 – 9:45", "duration": 45},
    "P4": {"time": "9:45 – 10:30", "duration": 45},
    "BREAK": {"time": "10:30 – 10:45", "duration": 15, "is_break": True},
    "P5": {"time": "10:45 – 11:30", "duration": 45},
    "P6": {"time": "11:30 – 12:15", "duration": 45},
    "P7": {"time": "12:15 – 1:00", "duration": 45},
    "LUNCH": {"time": "1:00 – 1:30", "duration": 30, "is_break": True},
    "P8": {"time": "1:30 – 2:15", "duration": 45},
    "P9": {"time": "2:15 – 3:00", "duration": 45},
    "P10": {"time": "4:05 – 4:50", "duration": 45},
}

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
