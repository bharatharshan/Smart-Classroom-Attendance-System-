"""Classroom model for geo-based attendance: room coordinates and allowed radius."""
import uuid
from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from datetime import datetime


class Classroom(Base):
    """Classroom/room with coordinates for geofence verification."""

    __tablename__ = "classrooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(String(50), unique=True, nullable=False, index=True)  # e.g. "105", "Room 105"
    room_name = Column(String(100), nullable=False)
    # Logical room key for WiFi subnet + reference images (e.g. cosol3, 811, 812)
    room_slug = Column(String(50), nullable=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    allowed_radius = Column(Float, nullable=False, default=20.0)  # meters

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Classroom {self.room_id} - {self.room_name}>"
