from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.disposition import (
    DispositionCreate,
    DispositionUpdate,
    DispositionResponse,
    LeadTabulateRequest,
    ChannelDispositionSlaCreate,
    ChannelDispositionSlaResponse
)

from app.schemas.lead import LeadResponse
from app.features.dispositions.service import DispositionService

router = APIRouter(prefix="/dispositions", tags=["Dispositions"])

@router.get("", response_model=List[DispositionResponse])
async def list_dispositions(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    service = DispositionService(db)
    return await service.list_dispositions(active_only=active_only)

@router.post("", response_model=DispositionResponse, status_code=status.HTTP_201_CREATED)
async def create_disposition(
    disposition_in: DispositionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem cadastrar tabulações")
    service = DispositionService(db)
    return await service.create_disposition(disposition_in)

@router.put("/{disposition_id}", response_model=DispositionResponse)
async def update_disposition(
    disposition_id: UUID,
    disposition_in: DispositionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar tabulações")
    service = DispositionService(db)
    disposition = await service.update_disposition(disposition_id, disposition_in)
    if not disposition:
        raise HTTPException(status_code=404, detail="Tabulação não encontrada")
    return disposition

@router.patch("/{disposition_id}/toggle", response_model=DispositionResponse)
async def toggle_disposition_active(
    disposition_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar tabulações")
    service = DispositionService(db)
    disposition = await service.toggle_active(disposition_id)
    if not disposition:
        raise HTTPException(status_code=404, detail="Tabulação não encontrada")
    return disposition

@router.delete("/{disposition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_disposition(
    disposition_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir tabulações")
    service = DispositionService(db)
    success = await service.delete_disposition(disposition_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tabulação não encontrada")
    return None

@router.post("/tabulate/{lead_id}", response_model=LeadResponse)
async def tabulate_lead(
    lead_id: UUID,
    tabulate_in: LeadTabulateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role in ["manager", "supervisor"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Gerentes e supervisores não podem tabular leads")
    service = DispositionService(db)
    lead = await service.tabulate_lead(lead_id, tabulate_in)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead ou tabulação não encontrada")
    return lead

@router.get("/channel-slas", response_model=List[ChannelDispositionSlaResponse])
async def list_channel_slas(
    channel_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    service = DispositionService(db)
    return await service.list_channel_slas(channel_id=channel_id)

@router.post("/channel-slas", response_model=ChannelDispositionSlaResponse, status_code=status.HTTP_201_CREATED)
async def upsert_channel_sla(
    sla_in: ChannelDispositionSlaCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem configurar sobrecargas de SLA por canal")
    service = DispositionService(db)
    return await service.upsert_channel_sla(sla_in)

@router.delete("/channel-slas/{sla_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel_sla(
    sla_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem remover sobrecargas de SLA por canal")
    service = DispositionService(db)
    success = await service.delete_channel_sla(sla_id)
    if not success:
        raise HTTPException(status_code=404, detail="Configuração de SLA por canal não encontrada")
    return None

