"""Classrooms API: CRUD and fetch coordinates for geo-based attendance."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.classroom import Classroom
from app.schemas.classroom import (
    ClassroomCreate,
    ClassroomUpdate,
    ClassroomResponse,
    ClassroomCoordinatesResponse,
)
from app.utils.faculty_dependencies import get_current_faculty
from app.models.faculty import Faculty

router = APIRouter(prefix="/classrooms", tags=["Classrooms"])


@router.get("", response_model=List[ClassroomResponse])
def list_classrooms(
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
):
    """List all classrooms (for dropdown in timetable edit)."""
    return db.query(Classroom).order_by(Classroom.room_id).all()


@router.get("/{room_id}", response_model=ClassroomResponse)
def get_classroom(
    room_id: UUID,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
):
    """Get a classroom by id."""
    room = db.query(Classroom).filter(Classroom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    return room


@router.get("/{room_id}/coordinates", response_model=ClassroomCoordinatesResponse)
def get_classroom_coordinates(
    room_id: UUID,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
):
    """
    Fetch classroom coordinates by room id (for timetable auto-fill).
    Returns latitude, longitude, allowed_radius as read-only fields for the teacher.
    """
    room = db.query(Classroom).filter(Classroom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    return ClassroomCoordinatesResponse(
        room_id=room.room_id,
        room_name=room.room_name,
        latitude=room.latitude,
        longitude=room.longitude,
        allowed_radius=room.allowed_radius,
    )


@router.post("", response_model=ClassroomResponse, status_code=status.HTTP_201_CREATED)
def create_classroom(
    data: ClassroomCreate,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
):
    """Create a new classroom (admin/faculty)."""
    existing = db.query(Classroom).filter(Classroom.room_id == data.room_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Room id '{data.room_id}' already exists",
        )
    room = Classroom(
        room_id=data.room_id,
        room_name=data.room_name,
        latitude=data.latitude,
        longitude=data.longitude,
        allowed_radius=data.allowed_radius,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.put("/{room_id}", response_model=ClassroomResponse)
def update_classroom(
    room_id: UUID,
    data: ClassroomUpdate,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
):
    """Update a classroom."""
    room = db.query(Classroom).filter(Classroom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    if data.room_name is not None:
        room.room_name = data.room_name
    if data.latitude is not None:
        room.latitude = data.latitude
    if data.longitude is not None:
        room.longitude = data.longitude
    if data.allowed_radius is not None:
        room.allowed_radius = data.allowed_radius
    db.commit()
    db.refresh(room)
    return room


@router.delete("/{room_id}")
def delete_classroom(
    room_id: UUID,
    db: Session = Depends(get_db),
    current_faculty: Faculty = Depends(get_current_faculty),
):
    """Delete a classroom."""
    room = db.query(Classroom).filter(Classroom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    db.delete(room)
    db.commit()
    return {"message": "Classroom deleted"}
