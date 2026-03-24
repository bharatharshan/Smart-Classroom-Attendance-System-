from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional


class FacultyCreate(BaseModel):
    """Schema for faculty registration"""
    faculty_id: str = Field(..., min_length=1, max_length=50, description="Faculty ID (e.g., FAC001)")
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    department: Optional[str] = Field(None, max_length=100)
    designation: Optional[str] = Field(None, max_length=100)


class FacultyLogin(BaseModel):
    """Schema for faculty login"""
    email: EmailStr
    password: str


class FacultyResponse(BaseModel):
    """Schema for faculty response (excludes password)"""
    id: str  # Will be converted from UUID to string
    faculty_id: str
    name: str
    email: str
    department: Optional[str]
    designation: Optional[str]
    is_active: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}

    @field_validator('id', mode='before')
    @classmethod
    def coerce_uuid_fields(cls, v):
        return str(v) if v is not None else v
        
    @classmethod
    def from_orm(cls, obj):
        """Convert ORM object to response model"""
        return cls(
            id=str(obj.id),  # Convert UUID to string
            faculty_id=obj.faculty_id,
            name=obj.name,
            email=obj.email,
            department=obj.department,
            designation=obj.designation,
            is_active=obj.is_active,
            created_at=obj.created_at
        )


class FacultyToken(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"
