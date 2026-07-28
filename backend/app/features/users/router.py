from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.user import UserCreate, UserResponse, UserUpdateStatus
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

@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(user_id: UUID, status_in: UserUpdateStatus, db: AsyncSession = Depends(get_db)):
    service = UserService(db)
    user = await service.update_status(user_id, status_in)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user
