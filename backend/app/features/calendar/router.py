from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.schemas.calendar import (
    CalendarConfigResponse,
    CalendarConfigUpdate,
    HolidayCreate,
    HolidayUpdate,
    HolidayResponse,
    CalendarStatusResponse,
)
from app.features.calendar.service import CalendarService

router = APIRouter(prefix="/calendar", tags=["Calendar & Expediente"])

@router.get("/config", response_model=CalendarConfigResponse)
async def get_calendar_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    return await service.get_or_create_config()

@router.put("/config", response_model=CalendarConfigResponse)
async def update_calendar_config(
    config_in: CalendarConfigUpdate,
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    return await service.update_config(config_in)

@router.get("/status", response_model=CalendarStatusResponse)
async def get_calendar_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    return await service.get_current_status()

@router.get("/holidays", response_model=List[HolidayResponse])
async def list_holidays(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    return await service.list_holidays(active_only=active_only)

@router.post("/holidays", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
async def create_holiday(
    holiday_in: HolidayCreate,
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    return await service.create_holiday(holiday_in)

@router.put("/holidays/{holiday_id}", response_model=HolidayResponse)
async def update_holiday(
    holiday_id: UUID,
    holiday_in: HolidayUpdate,
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    holiday = await service.update_holiday(holiday_id, holiday_in)
    if not holiday:
        raise HTTPException(status_code=404, detail="Feriado não encontrado")
    return holiday

@router.patch("/holidays/{holiday_id}/toggle", response_model=HolidayResponse)
async def toggle_holiday_active(
    holiday_id: UUID,
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    holiday = await service.toggle_holiday(holiday_id)
    if not holiday:
        raise HTTPException(status_code=404, detail="Feriado não encontrado")
    return holiday

@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holiday(
    holiday_id: UUID,
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    service = CalendarService(db)
    success = await service.delete_holiday(holiday_id)
    if not success:
        raise HTTPException(status_code=404, detail="Feriado não encontrado")

