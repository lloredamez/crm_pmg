from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserUpdateStatus
from app.features.users.service import UserService

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.create_user(user_in)

@router.get("", response_model=List[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    return await service.get_all_users()

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: UUID, user_in: UserUpdate, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.update_user(user_id, user_in)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(user_id: UUID, status_in: UserUpdateStatus, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.update_status(user_id, status_in)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.patch("/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(user_id: UUID, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.toggle_active(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    success = await service.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return None


@router.get("/units/all")
async def list_units(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.models.unit import Unit
    result = await db.execute(select(Unit).where(Unit.is_active.is_(True)).order_by(Unit.code))
    units = result.scalars().all()
    return [{"id": str(u.id), "name": u.name, "code": u.code} for u in units]
