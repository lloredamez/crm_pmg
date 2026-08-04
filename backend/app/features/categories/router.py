from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.features.categories.service import CategoryService

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db)
):
    service = CategoryService(db)
    return await service.list_categories(active_only=active_only)

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem cadastrar categorias")
    service = CategoryService(db)
    return await service.create_category(category_in)

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    category_in: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar categorias")
    service = CategoryService(db)
    category = await service.update_category(category_id, category_in)
    if not category:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return category

@router.patch("/{category_id}/toggle", response_model=CategoryResponse)
async def toggle_category_active(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar categorias")
    service = CategoryService(db)
    category = await service.toggle_active(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir categorias")
    service = CategoryService(db)
    success = await service.delete_category(category_id)
    if not success:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return None
