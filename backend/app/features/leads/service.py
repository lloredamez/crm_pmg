from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import selectinload
from app.models.lead import Lead
from app.models.user import User
from app.models.lead_assignment import LeadAssignment
from app.schemas.lead import LeadCreate, LeadUpdateStatus
from app.core.socket_manager import emit_lead_assigned, emit_lead_reassigned

class LeadService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_and_assign_lead(self, lead_in: LeadCreate) -> Lead:
        lead = Lead(
            name=lead_in.name,
            phone=lead_in.phone,
            email=lead_in.email,
            meta_lead_id=lead_in.meta_lead_id,
            campaign_name=lead_in.campaign_name,
            status="new"
        )
        self.db.add(lead)
        await self.db.flush()

        # Distribute via Round-Robin / Capacity Balance
        assigned_user = await self.distribute_lead(lead)
        await self.db.commit()
        await self.db.refresh(lead)

        if assigned_user:
            # Trigger Socket Event
            lead_dict = {
                "id": str(lead.id),
                "name": lead.name,
                "phone": lead.phone,
                "email": lead.email,
                "campaign_name": lead.campaign_name,
                "status": lead.status,
                "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                "attendant_name": assigned_user.name
            }
            await emit_lead_assigned(str(assigned_user.id), lead_dict)

            # Enqueue SLA Timeout Worker Task
            try:
                from app.workers.sla_tasks import check_lead_sla_timeout
                check_lead_sla_timeout.apply_async(
                    args=[str(lead.id)],
                    countdown=15 * 60 # 15 min timeout
                )
            except Exception as e:
                pass

        return lead

    async def distribute_lead(self, lead: Lead) -> Optional[User]:
        # Query online attendants
        result = await self.db.execute(
            select(User).where(
                User.status == "online",
                User.role.in_(["attendant", "supervisor"])
            )
        )
        online_users = list(result.scalars().all())

        if not online_users:
            lead.status = "new"
            return None

        # Find user with least active assigned leads
        user_load = []
        for user in online_users:
            active_count_res = await self.db.execute(
                select(func.count(Lead.id)).where(
                    Lead.current_attendant_id == user.id,
                    Lead.status.in_(["assigned", "in_progress"])
                )
            )
            count = active_count_res.scalar() or 0
            if count < user.max_simultaneous_leads:
                user_load.append((count, user))

        if not user_load:
            lead.status = "new"
            return None

        # Pick user with lowest load
        user_load.sort(key=lambda x: x[0])
        selected_user = user_load[0][1]

        now = datetime.now(timezone.utc)
        lead.current_attendant_id = selected_user.id
        lead.status = "assigned"
        lead.assigned_at = now

        # Record assignment history
        assignment = LeadAssignment(
            lead_id=lead.id,
            attendant_id=selected_user.id,
            status="active",
            assigned_at=now
        )
        self.db.add(assignment)
        return selected_user

    async def get_lead_by_id(self, lead_id: UUID) -> Optional[Lead]:
        result = await self.db.execute(
            select(Lead)
            .options(selectinload(Lead.current_attendant))
            .where(Lead.id == lead_id)
        )
        return result.scalar_one_or_none()

    async def list_leads(
        self,
        page: int = 1,
        limit: int = 10,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        attendant_id: Optional[UUID] = None
    ) -> Tuple[List[Lead], int]:
        query = select(Lead).options(selectinload(Lead.current_attendant))

        if status_filter and status_filter.lower() != "all":
            query = query.where(Lead.status == status_filter.lower())

        if attendant_id:
            query = query.where(Lead.current_attendant_id == attendant_id)

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Lead.name.ilike(search_pattern),
                    Lead.phone.ilike(search_pattern),
                    Lead.email.ilike(search_pattern),
                    Lead.campaign_name.ilike(search_pattern)
                )
            )

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await self.db.execute(count_query)
        total = total_res.scalar() or 0

        # Pagination & Ordering
        offset = (page - 1) * limit
        query = query.order_by(Lead.created_at.desc()).offset(offset).limit(limit)

        result = await self.db.execute(query)
        leads = list(result.scalars().all())
        return leads, total

    async def update_status(self, lead_id: UUID, new_status: str) -> Optional[Lead]:
        lead = await self.get_lead_by_id(lead_id)
        if not lead:
            return None
        
        lead.status = new_status
        lead.last_interaction_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(lead)
        return lead

    async def reassign_lead(self, lead_id: UUID, new_attendant_id: UUID, reason: str = "manually_reassigned") -> Optional[Lead]:
        lead = await self.get_lead_by_id(lead_id)
        if not lead:
            return None

        old_attendant_id = lead.current_attendant_id
        now = datetime.now(timezone.utc)

        # Invalidate old active assignment
        if old_attendant_id:
            await self.db.execute(
                update(LeadAssignment)
                .where(
                    LeadAssignment.lead_id == lead_id,
                    LeadAssignment.attendant_id == old_attendant_id,
                    LeadAssignment.status == "active"
                )
                .values(status=reason, unassigned_at=now)
            )

        # Assign to new attendant
        lead.current_attendant_id = new_attendant_id
        lead.status = "assigned"
        lead.assigned_at = now

        new_assignment = LeadAssignment(
            lead_id=lead.id,
            attendant_id=new_attendant_id,
            status="active",
            assigned_at=now
        )
        self.db.add(new_assignment)
        await self.db.commit()
        await self.db.refresh(lead)

        # Fetch attendant for notification
        new_attendant_res = await self.db.execute(select(User).where(User.id == new_attendant_id))
        new_attendant = new_attendant_res.scalar_one_or_none()

        lead_dict = {
            "id": str(lead.id),
            "name": lead.name,
            "phone": lead.phone,
            "email": lead.email,
            "status": lead.status,
            "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
            "attendant_name": new_attendant.name if new_attendant else ""
        }
        await emit_lead_reassigned(str(old_attendant_id) if old_attendant_id else "", str(new_attendant_id), lead_dict)

        return lead
