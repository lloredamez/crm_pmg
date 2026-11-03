import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, Date, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class CalendarConfig(Base):
    __tablename__ = "calendar_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pause_on_weekends = Column(Boolean, default=True, nullable=False)
    pause_on_holidays = Column(Boolean, default=True, nullable=False)
    pause_night_shift = Column(Boolean, default=True, nullable=False)
    work_start_hour = Column(Integer, default=7, nullable=False)
    work_end_hour = Column(Integer, default=19, nullable=False)
    work_days = Column(JSON, default=lambda: [0, 1, 2, 3, 4], nullable=False) # 0=Segunda, 4=Sexta, 5=Sábado, 6=Domingo
    timezone = Column(String(50), default="America/Sao_Paulo", nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

class Holiday(Base):
    __tablename__ = "calendar_holidays"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    holiday_type = Column(String(50), default="national", nullable=False) # national, regional, custom
    is_recurring = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

