from pydantic import BaseModel, Field, validator, field_validator
from datetime import datetime
from typing import Optional, Dict, Any
from app.models.timetable import PERIODS, DAYS


class TimetableEntry(BaseModel):
    """Single entry in timetable"""
    subject: Optional[str] = None
    class_name: Optional[str] = None  # e.g., "6MCA-A"
    room: Optional[str] = None
    room_id: Optional[str] = None  # Classroom UUID for geo; coordinates fetched from classrooms API
    is_break: bool = False
    
    @validator('class_name')
    def validate_class_name(cls, v):
        allowed_classes = ['1MCA-A', '1MCA-B', '6MCA-A', '6MCA-B']
        if v and v not in allowed_classes:
            raise ValueError(f'Class must be one of: {", ".join(allowed_classes)}')
        return v


class TimetableData(BaseModel):
    """Complete timetable structure"""
    Monday: Dict[str, TimetableEntry]
    Tuesday: Dict[str, TimetableEntry]
    Wednesday: Dict[str, TimetableEntry]
    Thursday: Dict[str, TimetableEntry]
    Friday: Dict[str, TimetableEntry]


class TimetableCreate(BaseModel):
    """Schema for creating timetable"""
    timetable_data: TimetableData
    academic_year: str = Field(default="2025-2026")
    semester: str = Field(default="Odd")


class TimetableUpdate(BaseModel):
    """Schema for updating timetable"""
    timetable_data: TimetableData
    academic_year: Optional[str] = None
    semester: Optional[str] = None


class TimetableResponse(BaseModel):
    """Schema for timetable response"""
    id: str
    faculty_id: str
    timetable_data: TimetableData
    academic_year: str
    semester: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

    @field_validator('id', 'faculty_id', mode='before')
    @classmethod
    def coerce_uuid_fields(cls, v):
        return str(v) if v is not None else v
    @classmethod
    def from_orm(cls, obj):
        """Convert ORM object to response model"""
        return cls(
            id=str(obj.id),
            faculty_id=str(obj.faculty_id),
            timetable_data=obj.timetable_data,
            academic_year=obj.academic_year,
            semester=obj.semester,
            is_active=obj.is_active,
            created_at=obj.created_at,
            updated_at=obj.updated_at
        )


class PeriodInfo(BaseModel):
    """Information about a period"""
    period: str
    time: str
    duration: int
    is_break: bool = False


class TimetableTemplate(BaseModel):
    """Template for creating new timetable"""
    periods: Dict[str, PeriodInfo]
    days: list[str]
    
    @classmethod
    def get_default_template(cls):
        """Get default timetable template"""
        return cls(
            periods=PERIODS,
            days=DAYS
        )
