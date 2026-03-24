from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import List, Optional

def _to_str(v):
    """Coerce UUID or any value to str."""
    return str(v) if v is not None else v


class EnrollmentResponse(BaseModel):
    """Response schema for a class enrollment"""
    id: str
    student_id: str
    class_id: str
    joined_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', 'student_id', 'class_id', mode='before')
    @classmethod
    def coerce_uuid_fields(cls, v):
        return _to_str(v)


class EnrolledStudentInfo(BaseModel):
    """Faculty-facing: student info + their attendance status for a class"""
    student_id: str
    student_db_id: str
    name: str
    email: str
    year: Optional[str]
    joined_at: datetime
    attendance_status: Optional[str] = None  # "PRESENT", "ABSENT", "IN_PROGRESS", None


class StudentAttendanceRecord(BaseModel):
    """Per-student counts for View Attendance (faculty)."""
    student_id: str  # roll / college id
    name: str
    email: str
    present: int = 0
    late: int = 0
    absent: int = 0
    total_sessions: int = 0  # present + late + absent (marked sessions)


class StudentAttendanceSummaryResponse(BaseModel):
    """GET /faculty/classes/{id}/students/attendance-summary"""
    class_id: str
    subject_name: str
    subject_code: Optional[str] = None
    class_code: str
    batch: Optional[str] = None
    students: List[StudentAttendanceRecord]


class StudentLastSessionRow(BaseModel):
    """Enrolled student + latest attendance row for that class (My Classes detail)."""
    student_id: str
    student_db_id: str
    name: str
    email: str
    year: Optional[str] = None
    last_session_date: Optional[str] = None  # ISO date
    status: Optional[str] = None  # PRESENT, LATE, ABSENT, IN_PROGRESS
    status_label: str  # On time, Late, Absent, In progress, No record


class StudentsLastSessionResponse(BaseModel):
    """GET /faculty/classes/{id}/students/last-session"""
    class_id: str
    subject_name: str
    class_code: str
    batch: Optional[str] = None
    students: List[StudentLastSessionRow]
