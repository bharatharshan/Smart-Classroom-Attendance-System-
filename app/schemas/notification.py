from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class NotificationPermissionUpdate(BaseModel):
    """Request body to enable/disable browser notifications."""
    enabled: bool = Field(..., description="True to allow class reminder notifications")


class NotificationResponse(BaseModel):
    """Single notification for API response."""
    id: str
    student_id: str
    title: str
    body: Optional[str] = None
    class_start_time: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=str(obj.id),
            student_id=str(obj.student_id),
            title=obj.title,
            body=obj.body,
            class_start_time=obj.class_start_time,
            read_at=obj.read_at,
            created_at=obj.created_at,
        )
