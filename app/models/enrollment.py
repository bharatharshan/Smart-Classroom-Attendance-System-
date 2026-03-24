import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ClassEnrollment(Base):
    """
    Tracks which students have enrolled (joined the roster) for a class.
    A student must enroll before they can mark attendance.
    Uses PostgreSQL native UUID type to match students.id and classes.id PKs.
    """

    __tablename__ = "class_enrollments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    class_id = Column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="enrollments")
    class_obj = relationship("Class", back_populates="enrollments")

    # Each student can only enroll once per class
    __table_args__ = (
        UniqueConstraint("student_id", "class_id", name="unique_student_class_enrollment"),
    )

    def __repr__(self):
        return f"<ClassEnrollment student={self.student_id} class={self.class_id}>"
