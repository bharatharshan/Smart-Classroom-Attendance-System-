import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class MovementStatus(enum.Enum):
    """Movement status enumeration"""
    STATIONARY = "STATIONARY"
    MOVING = "MOVING"


class LocationPing(Base):
    """LocationPing model for storing periodic location updates during class"""
    
    __tablename__ = "location_pings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    attendance_id = Column(UUID(as_uuid=True), ForeignKey("attendances.id"), nullable=False)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    distance_from_class = Column(Float, nullable=True)  # Distance in meters
    is_inside_geofence = Column(Boolean, nullable=False)
    
    movement_status = Column(
        Enum(MovementStatus),
        default=MovementStatus.STATIONARY,
        nullable=False
    )
    
    # Optional Wi-Fi validation
    wifi_ssid = Column(String(100), nullable=True)
    wifi_bssid = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    attendance = relationship("Attendance", back_populates="location_pings")
    
    def __repr__(self):
        return f"<LocationPing {self.id} - {self.movement_status.value}>"
