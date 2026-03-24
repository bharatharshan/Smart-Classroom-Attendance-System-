from pydantic import BaseModel, EmailStr, Field, validator, field_validator
from datetime import datetime
from typing import Optional, List


class StudentCreate(BaseModel):
    """Schema for student registration"""
    student_id: str = Field(..., min_length=1, max_length=50, description="Student roll number or ID")
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    department: Optional[str] = Field(None, max_length=100)
    year: Optional[str] = Field(None, description="Class assignment")
    profile_photo: Optional[str] = Field(
        None,
        description="Base64-encoded profile photo captured or uploaded during registration",
    )
    
    @validator('year')
    def validate_year(cls, v):
        allowed_classes = ['1MCA-A', '1MCA-B', '6MCA-A', '6MCA-B']
        if v and v not in allowed_classes:
            raise ValueError(f'Class must be one of: {", ".join(allowed_classes)}')
        return v


class StudentLogin(BaseModel):
    """Schema for student login"""
    email: EmailStr
    password: str


class StudentResponse(BaseModel):
    """Schema for student response (excludes password)"""
    id: str
    student_id: str
    name: str
    email: str
    department: Optional[str]
    year: Optional[str]
    is_active: bool
    face_enrolled: bool = False
    profile_photo: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('id', mode='before')
    @classmethod
    def coerce_id_to_str(cls, v):
        """Coerce UUID object → str before Pydantic v2 type-checking runs."""
        return str(v) if v is not None else v

    @classmethod
    def from_orm(cls, obj):
        """Explicit from_orm for routes that call it directly."""
        return cls(
            id=str(obj.id),
            student_id=obj.student_id,
            name=obj.name,
            email=obj.email,
            department=obj.department,
            year=obj.year,
            is_active=obj.is_active,
            face_enrolled=obj.face_enrolled,
            profile_photo=getattr(obj, "profile_photo", None),
            created_at=obj.created_at
        )


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"


class FaceEmbeddingPayload(BaseModel):
    """Generic 3D face embedding payload sent from frontend (e.g., 3D landmarks/descriptor)."""
    embedding: List[float] = Field(
        ...,
        description="3D face embedding vector (e.g., 3D landmarks or 3D descriptor)",
        min_items=16,
    )
    model: str = Field(
        "browser-3d-face-v1",
        description="Identifier for the 3D face model/technique used on the client."
    )
