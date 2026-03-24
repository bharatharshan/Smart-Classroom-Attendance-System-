"""Pydantic schemas for Subject API."""
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional


class SubjectBase(BaseModel):
    subject_code: str = Field(..., min_length=1, max_length=20)
    subject_name: str = Field(..., min_length=1, max_length=150)
    course: str = Field(..., min_length=1, max_length=50)
    semester: str = Field(..., min_length=1, max_length=10)


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    subject_name: Optional[str] = Field(None, max_length=150)
    course: Optional[str] = Field(None, max_length=50)
    semester: Optional[str] = Field(None, max_length=10)


class SubjectResponse(SubjectBase):
    id: UUID

    class Config:
        from_attributes = True
