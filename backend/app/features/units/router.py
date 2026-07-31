from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.unit import UnitCreate, UnitUpdate, UnitResponse
from app.features.units.service import UnitService

router = APIRouter(prefix="/units", tags=["Units"])

@router.get("", response_model=List[UnitResponse])
async def list_units(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    service = UnitService(db)
    return await service.list_units(active_only=active_only)

@router.post("", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
async def create_unit(
    unit_in: UnitCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem cadastrar lojas")
    service = UnitService(db)
    return await service.create_unit(unit_in)

@router.put("/{unit_id}", response_model=UnitResponse)
async def update_unit(
    unit_id: UUID,
    unit_in: UnitUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar lojas")
    service = UnitService(db)
    unit = await service.update_unit(unit_id, unit_in)
    if not unit:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    return unit

@router.delete("/{unit_id}", response_model=UnitResponse)
async def toggle_unit_active(
    unit_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar lojas")
    service = UnitService(db)
    unit = await service.toggle_active(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    return unit
