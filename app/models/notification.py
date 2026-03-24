"""Notification model for class reminders and other alerts."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Notification(Base):
    """Stores notifications for students (e.g. class starting in 5 minutes)."""

    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=True)
    # When the class starts (for dedupe and display)
    class_start_time = Column(DateTime, nullable=True)
    # Dedupe: e.g. "2025-02-24_Monday_P1_6MCA-A" so we don't create duplicate reminders
    reminder_key = Column(String(120), nullable=True, index=True)

    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", backref="notifications")
    class_obj = relationship("Class", backref="reminder_notifications")

    def __repr__(self):
        return f"<Notification {self.id} student={self.student_id} read={self.read_at is not None}>"
