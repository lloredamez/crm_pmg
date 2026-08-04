from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate

class CategoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_categories(self, active_only: bool = False) -> List[Category]:
        query = select(Category).order_by(Category.name.asc())
        if active_only:
            query = query.where(Category.is_active.is_(True))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_category_by_id(self, category_id: UUID) -> Optional[Category]:
        result = await self.db.execute(select(Category).where(Category.id == category_id))
        return result.scalar_one_or_none()

    async def create_category(self, category_in: CategoryCreate) -> Category:
        category = Category(
            name=category_in.name.strip(),
            description=category_in.description.strip() if category_in.description else None,
            color=category_in.color or "blue",
            is_active=category_in.is_active
        )
        self.db.add(category)
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def update_category(self, category_id: UUID, category_in: CategoryUpdate) -> Optional[Category]:
        category = await self.get_category_by_id(category_id)
        if not category:
            return None

        if category_in.name is not None:
            category.name = category_in.name.strip()
        if category_in.description is not None:
            category.description = category_in.description.strip() if category_in.description else None
        if category_in.color is not None:
            category.color = category_in.color
        if category_in.is_active is not None:
            category.is_active = category_in.is_active

        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def toggle_active(self, category_id: UUID) -> Optional[Category]:
        category = await self.get_category_by_id(category_id)
        if not category:
            return None
        category.is_active = not category.is_active
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def delete_category(self, category_id: UUID) -> bool:
        category = await self.get_category_by_id(category_id)
        if not category:
            return False
        await self.db.delete(category)
        await self.db.commit()
        return True
