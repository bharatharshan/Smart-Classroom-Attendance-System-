from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.student import Student
from app.models.notification import Notification
from app.schemas.notification import NotificationPermissionUpdate, NotificationResponse
from app.utils.dependencies import get_current_student

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.put("/permission", status_code=status.HTTP_200_OK)
def update_notification_permission(
    payload: NotificationPermissionUpdate,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Store the student's notification permission status (e.g. after they grant browser permission).
    """
    current_student.notification_enabled = payload.enabled
    db.commit()
    return {"enabled": payload.enabled}


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """
    Return unread notifications for the logged-in student (for polling and browser push).
    """
    items = (
        db.query(Notification)
        .filter(
            Notification.student_id == current_student.id,
            Notification.read_at.is_(None),
        )
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [NotificationResponse.from_orm(n) for n in items]


@router.patch("/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Mark a notification as read."""
    from datetime import datetime
    import uuid
    try:
        nid = uuid.UUID(notification_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == nid,
            Notification.student_id == current_student.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.read_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
