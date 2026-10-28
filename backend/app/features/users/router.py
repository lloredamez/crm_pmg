from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.models.unit import Unit
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserUpdateStatus
from app.features.users.service import UserService

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    current_user: User = Depends(require_roles(["admin", "supervisor"])),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role == "supervisor":
        if user_in.role not in ["attendant"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Supervisores só possuem permissão para cadastrar atendentes."
            )
        if current_user.unit_id:
            user_in.unit_id = current_user.unit_id

    service = UserService(db)
    return await service.create_user(user_in)

@router.get("", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    return await service.get_all_users()

@router.get("/units/all")
async def list_units(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Unit).where(Unit.is_active.is_(True)).order_by(Unit.code))
    units = result.scalars().all()
    return [{"id": str(u.id), "name": u.name, "code": u.code} for u in units]

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    user = await service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Permite edição por admins, supervisores (para atendentes) ou o próprio usuário editando seus dados
    if current_user.role != "admin" and current_user.id != user_id:
        if current_user.role != "supervisor":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para editar outros usuários."
            )

    service = UserService(db)
    user = await service.update_user(user_id, user_in)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: UUID,
    status_in: UserUpdateStatus,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Usuário pode alterar seu próprio status ou supervisor/admin alterar de outrem
    if current_user.id != user_id and current_user.role not in ["admin", "supervisor", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permissão negada para alterar o status deste usuário."
        )

    service = UserService(db)
    user = await service.update_status(user_id, status_in)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.patch("/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(
    user_id: UUID,
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode desativar seu próprio usuário."
        )
    service = UserService(db)
    user = await service.toggle_active(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_roles(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode excluir seu próprio usuário."
        )
    service = UserService(db)
    success = await service.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return None
