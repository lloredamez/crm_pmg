from uuid import UUID
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdateStatus

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, user_in: UserCreate) -> User:
        user = User(
            name=user_in.name,
            email=user_in.email,
            role=user_in.role,
            status=user_in.status,
            max_simultaneous_leads=user_in.max_simultaneous_leads
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_all_users(self) -> List[User]:
        result = await self.db.execute(select(User).order_by(User.name))
        return list(result.scalars().all())

    async def update_status(self, user_id: UUID, status_in: UserUpdateStatus) -> Optional[User]:
        user = await self.get_user_by_id(user_id)
        if not user:
            return None
        user.status = status_in.status
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_online_attendants(self) -> List[User]:
        result = await self.db.execute(
            select(User).where(
                User.status == 'online',
                User.role.in_(['attendant', 'supervisor'])
            ).order_by(User.name)
        )
        return list(result.scalars().all())
