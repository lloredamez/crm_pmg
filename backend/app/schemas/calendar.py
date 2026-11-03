from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List

class CalendarConfigBase(BaseModel):
    pause_on_weekends: bool = True
    pause_on_holidays: bool = True
    pause_night_shift: bool = True
    work_start_hour: int = Field(default=7, ge=0, le=23)
    work_end_hour: int = Field(default=19, ge=0, le=23)
    work_days: List[int] = Field(default=[0, 1, 2, 3, 4]) # 0=Segunda, 4=Sexta
    timezone: str = "America/Sao_Paulo"

class CalendarConfigUpdate(BaseModel):
    pause_on_weekends: Optional[bool] = None
    pause_on_holidays: Optional[bool] = None
    pause_night_shift: Optional[bool] = None
    work_start_hour: Optional[int] = Field(default=None, ge=0, le=23)
    work_end_hour: Optional[int] = Field(default=None, ge=0, le=23)
    work_days: Optional[List[int]] = None
    timezone: Optional[str] = None

class CalendarConfigResponse(CalendarConfigBase):
    id: UUID
    updated_at: datetime

    class Config:
        from_attributes = True

class HolidayBase(BaseModel):
    date: date
    name: str = Field(..., min_length=2, max_length=150)
    holiday_type: str = Field(default="national")
    is_recurring: bool = False
    is_active: bool = True

class HolidayCreate(HolidayBase):
    pass

class HolidayUpdate(BaseModel):
    date: Optional[date] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    holiday_type: Optional[str] = None
    is_recurring: Optional[bool] = None
    is_active: Optional[bool] = None

class HolidayResponse(HolidayBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class CalendarStatusResponse(BaseModel):
    is_paused: bool
    reason: Optional[str] = None
    current_time: str
    is_weekend: bool
    is_holiday: bool
    holiday_name: Optional[str] = None
    is_night_shift: bool
    work_start_hour: int = 7
    work_end_hour: int = 19
    pause_on_weekends: bool = True
    pause_on_holidays: bool = True
    pause_night_shift: bool = True
    active_holiday_dates: List[str] = Field(default_factory=list)


