"""Subject model for storing subject definitions."""
import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from datetime import datetime


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_code = Column(String(20), unique=True, nullable=False, index=True)
    subject_name = Column(String(150), nullable=False)
    course = Column(String(50), nullable=False)
    semester = Column(String(10), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Subject {self.subject_code} - {self.subject_name}>"
