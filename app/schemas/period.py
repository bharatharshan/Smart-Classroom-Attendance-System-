"""Pydantic schemas for Period API."""
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional


class PeriodBase(BaseModel):
    period_id: str = Field(..., min_length=1, max_length=20)
    period_name: str = Field(..., min_length=1, max_length=100)
    start_time: str = Field(..., min_length=5, max_length=10, description="HH:MM format")
    end_time: str = Field(..., min_length=5, max_length=10, description="HH:MM format")
    period_type: str = Field("class", description="'class' or 'break'")
    sort_order: int = Field(0, description="Fixed position in timetable")


class PeriodCreate(PeriodBase):
    pass


class PeriodUpdate(BaseModel):
    period_name: Optional[str] = Field(None, max_length=100)
    start_time: Optional[str] = Field(None, max_length=10)
    end_time: Optional[str] = Field(None, max_length=10)
    period_type: Optional[str] = Field(None, max_length=20)
    sort_order: Optional[int] = None


class PeriodResponse(PeriodBase):
    id: UUID

    class Config:
        from_attributes = True
