"""Pydantic schemas for Classroom API."""
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional


class ClassroomBase(BaseModel):
    room_id: str = Field(..., min_length=1, max_length=50, description="Room identifier e.g. 105, Room 105")
    room_name: str = Field(..., min_length=1, max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    allowed_radius: float = Field(20.0, ge=1, le=500, description="Allowed radius in meters (default 20)")
    room_slug: Optional[str] = Field(
        None,
        max_length=50,
        description="Network/venue key for WiFi validation & reference images (e.g. cosol3, 811)",
    )


class ClassroomCreate(ClassroomBase):
    pass


class ClassroomUpdate(BaseModel):
    room_name: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    allowed_radius: Optional[float] = Field(None, ge=1, le=500)
    room_slug: Optional[str] = Field(None, max_length=50)


class ClassroomResponse(ClassroomBase):
    id: UUID

    class Config:
        from_attributes = True


class ClassroomCoordinatesResponse(BaseModel):
    """Response for fetching coordinates only (e.g. timetable auto-fill)."""
    room_id: str
    room_name: str
    latitude: float
    longitude: float
    allowed_radius: float

    class Config:
        from_attributes = True
