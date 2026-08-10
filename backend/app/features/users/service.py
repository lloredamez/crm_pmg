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
            cpf=user_in.cpf,
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
        if user_in.cpf is not None:
            user.cpf = user_in.cpf
        if user_in.role is not None:
            user.role = user_in.role
        if user_in.is_active is not None:
            user.is_active = user_in.is_active
            if not user_in.is_active:
                user.status = "offline"
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

    async def toggle_active(self, user_id: UUID) -> Optional[User]:
        user = await self.get_user_by_id(user_id)
        if not user:
            return None

        user.is_active = not user.is_active
        if not user.is_active:
            user.status = "offline"

        await self.db.commit()
        await self.db.refresh(user)

        from app.core.socket_manager import emit_user_status_updated
        await emit_user_status_updated(user.id, user.status, user.name)
        return user

    async def delete_user(self, user_id: UUID) -> bool:
        user = await self.get_user_by_id(user_id)
        if not user:
            return False

        from app.models.lead import Lead
        from app.models.bucket_lead import BucketLead

        # 1. Unassign active leads assigned to this user, send them back to bucket/unassigned
        active_leads_res = await self.db.execute(
            select(Lead).where(
                Lead.current_attendant_id == user_id,
                Lead.status.in_(["assigned", "in_progress"])
            )
        )
        active_leads = list(active_leads_res.scalars().all())
        for lead in active_leads:
            bucket_lead = BucketLead(
                id=lead.id,
                name=lead.name,
                phone=lead.phone,
                cpf=lead.cpf,
                verified_cpf=lead.verified_cpf,
                proposal_number=lead.proposal_number,
                notes=lead.notes,
                email=lead.email,
                meta_lead_id=lead.meta_lead_id,
                campaign_name=lead.campaign_name,
                product_name=lead.product_name,
                channel_code=lead.channel_code,
                prazo=lead.prazo,
                margem=lead.margem,
                valor_liberado=lead.valor_liberado,
                banco=lead.banco,
                tabela=lead.tabela,
                unit_id=lead.unit_id,
                created_at=lead.created_at
            )
            self.db.add(bucket_lead)
            await self.db.delete(lead)

        user.managed_units = []
        await self.db.delete(user)
        await self.db.commit()
        return True

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

        from app.core.socket_manager import emit_user_status_updated
        await emit_user_status_updated(user.id, user.status, user.name)

        return user

    async def get_online_attendants(self) -> List[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.managed_units)).where(
                User.is_active.is_(True),
                User.status == 'online',
                User.role.in_(['attendant', 'supervisor', 'manager'])
            ).order_by(User.name)
        )
        return list(result.scalars().all())

