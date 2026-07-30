from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.models.user import User
from app.models.unit import Unit
from app.schemas.user import UserCreate, UserUpdate, UserUpdateStatus
from app.core.security import get_password_hash

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, user_in: UserCreate) -> User:
        user = User(
            name=user_in.name,
            email=user_in.email,
            role=user_in.role,
            status=user_in.status,
            max_simultaneous_leads=user_in.max_simultaneous_leads,
            unit_id=user_in.unit_id
        )
        if user_in.managed_unit_ids:
            units_res = await self.db.execute(select(Unit).where(Unit.id.in_(user_in.managed_unit_ids)))
            user.managed_units = list(units_res.scalars().all())

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.managed_units)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all_users(self) -> List[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.managed_units)).order_by(User.name)
        )
        return list(result.scalars().all())

    async def update_user(self, user_id: UUID, user_in: UserUpdate) -> Optional[User]:
        user = await self.get_user_by_id(user_id)
        if not user:
            return None

        if user_in.name is not None:
            user.name = user_in.name
        if user_in.email is not None:
            user.email = user_in.email
        if user_in.role is not None:
            user.role = user_in.role
        if user_in.max_simultaneous_leads is not None:
            user.max_simultaneous_leads = user_in.max_simultaneous_leads
        if user_in.unit_id is not None:
            user.unit_id = user_in.unit_id
        if user_in.password:
            user.hashed_password = get_password_hash(user_in.password)

        if user_in.managed_unit_ids is not None:
            if user_in.managed_unit_ids:
                units_res = await self.db.execute(select(Unit).where(Unit.id.in_(user_in.managed_unit_ids)))
                user.managed_units = list(units_res.scalars().all())
            else:
                user.managed_units = []

        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_status(self, user_id: UUID, status_in: UserUpdateStatus) -> Optional[User]:
        user = await self.get_user_by_id(user_id)
        if not user:
            return None
        old_status = user.status
        user.status = status_in.status
        await self.db.commit()
        await self.db.refresh(user)

        if status_in.status == "online" and old_status != "online":
            from app.features.leads.service import LeadService
            lead_service = LeadService(self.db)
            await lead_service.process_pending_unassigned_leads(limit=10)

        return user

    async def get_online_attendants(self) -> List[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.managed_units)).where(
                User.status == 'online',
                User.role.in_(['attendant', 'supervisor', 'manager'])
            ).order_by(User.name)
        )
        return list(result.scalars().all())

