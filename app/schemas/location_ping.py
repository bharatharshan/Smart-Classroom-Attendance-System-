from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional
from enum import Enum


class MovementStatus(str, Enum):
    """Movement status enumeration"""
    STATIONARY = "STATIONARY"
    MOVING = "MOVING"


class LocationPingCreate(BaseModel):
    """Schema for submitting a location ping"""
    attendance_id: UUID
    latitude: float = Field(..., ge=-90, le=90, description="Current latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Current longitude")
    wifi_ssid: Optional[str] = Field(None, max_length=100, description="Wi-Fi SSID (optional)")
    wifi_bssid: Optional[str] = Field(None, max_length=50, description="Wi-Fi BSSID (optional)")


class LocationPingResponse(BaseModel):
    """Schema for location ping response"""
    id: UUID
    distance_from_class: float
    is_inside_geofence: bool
    movement_status: MovementStatus
    recommended_next_ping_seconds: int
    confidence_score: Optional[float]
    total_pings: int
    message: str
    
    class Config:
        from_attributes = True


class LocationPingDetail(BaseModel):
    """Schema for detailed location ping information"""
    id: UUID
    attendance_id: UUID
    latitude: float
    longitude: float
    timestamp: datetime
    distance_from_class: Optional[float]
    is_inside_geofence: bool
    movement_status: MovementStatus
    wifi_ssid: Optional[str]
    wifi_bssid: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
