from uuid import UUID
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.user import User
from app.features.logs.service import LogsService
from app.schemas.logs import (
    ActivityLogsResponse,
    TransferLogsResponse,
    LeadChangeLogsResponse,
)

router = APIRouter(prefix="/logs", tags=["Logs"])


@router.get("/activity", response_model=ActivityLogsResponse)
async def get_activity_logs(
    channel_code: Optional[str] = Query(None, max_length=50),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    attendant_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    service = LogsService(db)
    return await service.get_activity_logs(
        current_user=current_user,
        channel_code=channel_code,
        start_date=start_date,
        end_date=end_date,
        attendant_id=attendant_id,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/transfers", response_model=TransferLogsResponse)
async def get_transfer_logs(
    channel_code: Optional[str] = Query(None, max_length=50),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    event_type: Optional[str] = Query("all", pattern="^(all|assigned|claimed_from_bucket|reassigned|sla_breached)$"),
    attendant_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    service = LogsService(db)
    return await service.get_transfer_logs(
        current_user=current_user,
        channel_code=channel_code,
        start_date=start_date,
        end_date=end_date,
        event_type=event_type,
        attendant_id=attendant_id,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/lead-changes", response_model=LeadChangeLogsResponse)
async def get_lead_change_logs(
    channel_code: Optional[str] = Query(None, max_length=50),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    event_type: Optional[str] = Query("all", pattern="^(all|tabulated|details_updated|status_updated)$"),
    attendant_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None, max_length=120),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db),
):
    service = LogsService(db)
    return await service.get_lead_change_logs(
        current_user=current_user,
        channel_code=channel_code,
        start_date=start_date,
        end_date=end_date,
        event_type=event_type,
        attendant_id=attendant_id,
        search=search,
        limit=limit,
        offset=offset,
    )
