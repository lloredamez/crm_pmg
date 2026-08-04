import math
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.lead import (
    LeadCreate,
    LeadResponse,
    LeadPaginationResponse,
    LeadUpdateStatus,
    LeadUpdateDetails,
    LeadReassign,
    BulkReassignRequest
)
from app.schemas.sla_breach import SlaBreachResponse, SlaBreachPaginationResponse
from app.schemas.lead_history import LeadHistoryItem
from app.features.leads.service import LeadService


router = APIRouter(prefix="/leads", tags=["Leads"])

@router.get("/sla-breaches", response_model=SlaBreachPaginationResponse)
async def list_sla_breaches(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    attendant_id: Optional[UUID] = Query(None),
    unit_id: Optional[UUID] = Query(None),
    breach_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    items, total = await service.list_sla_breaches(
        page=page,
        limit=limit,
        attendant_id=attendant_id,
        unit_id=unit_id,
        breach_type=breach_type
    )
    pages = math.ceil(total / limit) if total > 0 else 1
    return SlaBreachPaginationResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(lead_in: LeadCreate, db: AsyncSession = Depends(get_db)):
    service = LeadService(db)
    return await service.create_and_assign_lead(lead_in)


@router.get("", response_model=LeadPaginationResponse)
async def list_leads(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    attendant_id: Optional[UUID] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    leads, total = await service.list_leads(
        page=page,
        limit=limit,
        status_filter=status,
        search=search,
        attendant_id=attendant_id,
        current_user=current_user
    )
    pages = math.ceil(total / limit) if total > 0 else 1
    return LeadPaginationResponse(
        items=leads,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: UUID,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    lead = await service.get_lead_by_id(lead_id, current_user=current_user)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead

@router.patch("/{lead_id}/status", response_model=LeadResponse)
async def update_lead_status(
    lead_id: UUID,
    status_in: LeadUpdateStatus,
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    lead = await service.update_status(lead_id, status_in.status)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead

@router.patch("/{lead_id}/details", response_model=LeadResponse)
async def update_lead_details(
    lead_id: UUID,
    details_in: LeadUpdateDetails,
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    lead = await service.update_details(lead_id, details_in)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead

@router.post("/{lead_id}/reveal", response_model=LeadResponse)
async def reveal_lead(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    lead = await service.reveal_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead

@router.post("/{lead_id}/reassign", response_model=LeadResponse)
async def reassign_lead(
    lead_id: UUID,
    reassign_in: LeadReassign,
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    lead = await service.reassign_lead(lead_id, reassign_in.attendant_id, reason="manually_reassigned")
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead

@router.post("/bulk-reassign", status_code=status.HTTP_200_OK)
async def bulk_reassign_leads(
    bulk_in: BulkReassignRequest,
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    reassigned_count = 0
    for lead_id in bulk_in.lead_ids:
        lead = await service.reassign_lead(lead_id, bulk_in.attendant_id, reason="bulk_manually_reassigned")
        if lead:
            reassigned_count += 1
    return {"message": f"{reassigned_count} leads reatribuídos com sucesso"}

@router.get("/{lead_id}/history", response_model=List[LeadHistoryItem])
async def get_lead_history(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    service = LeadService(db)
    lead = await service.get_lead_by_id(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return await service.get_lead_history(lead_id)

