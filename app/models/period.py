"""Period model for storing class/break period definitions."""
import uuid
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from datetime import datetime


class Period(Base):
    __tablename__ = "periods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_id = Column(String(20), unique=True, nullable=False, index=True)
    period_name = Column(String(100), nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    period_type = Column(String(20), nullable=False, default="class")
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Period {self.period_id} - {self.period_name}>"
