from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.unit import Unit
from app.schemas.unit import UnitCreate, UnitUpdate

class UnitService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_units(self, active_only: bool = False) -> List[Unit]:
        query = select(Unit).order_by(Unit.name.asc())
        if active_only:
            query = query.where(Unit.is_active.is_(True))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_unit_by_id(self, unit_id: UUID) -> Optional[Unit]:
        result = await self.db.execute(select(Unit).where(Unit.id == unit_id))
        return result.scalar_one_or_none()

    async def create_unit(self, unit_in: UnitCreate) -> Unit:
        # Generate code if not provided
        code = unit_in.code
        if not code or not code.strip():
            count_res = await self.db.execute(select(func.count(Unit.id)))
            count = count_res.scalar() or 0
            code = f"U{count + 1}"

        unit = Unit(
            name=unit_in.name,
            code=code.upper().strip(),
            is_active=unit_in.is_active
        )
        self.db.add(unit)
        await self.db.commit()
        await self.db.refresh(unit)
        return unit

    async def update_unit(self, unit_id: UUID, unit_in: UnitUpdate) -> Optional[Unit]:
        unit = await self.get_unit_by_id(unit_id)
        if not unit:
            return None

        if unit_in.name is not None:
            unit.name = unit_in.name
        if unit_in.code is not None and unit_in.code.strip():
            unit.code = unit_in.code.upper().strip()
        if unit_in.is_active is not None:
            unit.is_active = unit_in.is_active

        await self.db.commit()
        await self.db.refresh(unit)
        return unit

    async def toggle_active(self, unit_id: UUID) -> Optional[Unit]:
        unit = await self.get_unit_by_id(unit_id)
        if not unit:
            return None
        unit.is_active = not unit.is_active
        await self.db.commit()
        await self.db.refresh(unit)
        return unit
