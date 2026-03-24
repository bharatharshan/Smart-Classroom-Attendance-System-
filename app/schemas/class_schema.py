from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional
import uuid


class ClassCreate(BaseModel):
    """Schema for creating a new class (faculty) - kept for internal use"""
    class_code: str = Field(..., min_length=1, max_length=50)
    subject_name: str = Field(..., min_length=1, max_length=100)
    subject_code: Optional[str] = Field(None, max_length=50)
    faculty_name: Optional[str] = Field(None, max_length=100)
    batch: str = Field(..., description="Target student batch, e.g. '6MCA-A'")
    start_time: datetime
    end_time: datetime

    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius: Optional[float] = Field(None, gt=0, le=1000)


class ClassResponse(BaseModel):
    """Schema for class response"""
    id: str          # UUID serialized to str
    class_code: str
    subject_name: str
    subject_code: Optional[str] = None
    faculty_name: str
    faculty_id: Optional[str] = None
    batch: Optional[str] = None
    start_time: datetime
    end_time: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', 'faculty_id', mode='before')
    @classmethod
    def coerce_uuid_fields(cls, v):
        return str(v) if v is not None else v

    @classmethod
    def from_orm(cls, obj):
        data = {
            "id":           str(obj.id),
            "class_code":   obj.class_code,
            "subject_name": obj.subject_name,
            "subject_code": obj.subject_code,
            "faculty_name": obj.faculty_name,
            "faculty_id":   str(obj.faculty_id) if obj.faculty_id else None,
            "batch":        obj.batch,
            "start_time":   obj.start_time,
            "end_time":     obj.end_time,
            "latitude":     obj.latitude,
            "longitude":    obj.longitude,
            "radius":       obj.radius,
            "is_active":    obj.is_active,
            "created_at":   obj.created_at,
        }
        return cls(**data)


class FacultyRecentClassItem(ClassResponse):
    """Recent classes for faculty dashboard — includes latest attendance activity date."""
    last_activity_date: Optional[str] = None  # ISO date (latest session_date in attendances)


class ClassWithEnrollment(ClassResponse):
    """Class response with current student's enrollment status"""
    enrolled: bool = False
    attendance_marked: bool = False
    enrolled_count: int = 0
