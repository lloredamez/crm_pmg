from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.channel import ChannelCreate, ChannelUpdate, ChannelResponse
from app.features.channels.service import ChannelService

router = APIRouter(prefix="/channels", tags=["Channels"])

@router.get("", response_model=List[ChannelResponse])
async def list_channels(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    service = ChannelService(db)
    return await service.list_channels(active_only=active_only)

@router.post("", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    channel_in: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem cadastrar canais")
    service = ChannelService(db)
    return await service.create_channel(channel_in)

@router.put("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: UUID,
    channel_in: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar canais")
    service = ChannelService(db)
    channel = await service.update_channel(channel_id, channel_in)
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    return channel

@router.patch("/{channel_id}/toggle", response_model=ChannelResponse)
async def toggle_channel_active(
    channel_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar canais")
    service = ChannelService(db)
    channel = await service.toggle_active(channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    return channel

@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir canais")
    service = ChannelService(db)
    success = await service.delete_channel(channel_id)
    if not success:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    return None
