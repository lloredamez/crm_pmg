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

    async def _find_eligible_attendant_for_unit(self, unit_id: UUID) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(
                User.status == "online",
                User.unit_id == unit_id,
                User.role.in_(["attendant"])
            )
        )
        online_users = list(result.scalars().all())
        if not online_users:
            return None

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
                last_assigned = user.last_assigned_at or datetime.min.replace(tzinfo=timezone.utc)
                user_load.append((count, last_assigned, user))

        if not user_load:
            return None

        # Ordena por menor carga e, em caso de empate, quem recebeu lead há mais tempo (Round-Robin)
        user_load.sort(key=lambda x: (x[0], x[1]))
        return user_load[0][2]

    async def distribute_lead(self, lead: Lead) -> Optional[User]:
        from app.models.unit import Unit
        from sqlalchemy import nullsfirst

        now = datetime.now(timezone.utc)
        selected_user: Optional[User] = None
        target_unit: Optional[Unit] = None

        # Cenário 1: Lead já possui unit_id específico vinculado na origem
        if lead.unit_id:
            unit_res = await self.db.execute(
                select(Unit)
                .where(Unit.id == lead.unit_id, Unit.is_active.is_(True)))
            target_unit = unit_res.scalar_one_or_none()
            if target_unit:
                selected_user = await self._find_eligible_attendant_for_unit(target_unit.id)

        # Cenário 2: Esteira Geral (ou Transbordo se a unidade de origem não tiver consultores online)
        if not selected_user:
            # Busca todas as unidades ativas ordenadas pela última atribuição (Round-Robin entre Unidades)
            units_res = await self.db.execute(
                select(Unit)
                .where(Unit.is_active.is_(True))
                .order_by(nullsfirst(Unit.last_assigned_at.asc()), Unit.code.asc())
            )
            units = list(units_res.scalars().all())

            # Itera sequencialmente nas unidades para encontrar a primeira com consultor disponível (Transbordo)
            for unit in units:
                user = await self._find_eligible_attendant_for_unit(unit.id)
                if user:
                    selected_user = user
                    target_unit = unit
                    break

        # Cenário 3: Atendentes Globais (sem unidade vinculada) como reserva de contingência
        if not selected_user:
            global_users_res = await self.db.execute(
                select(User).where(
                    User.status == "online",
                    User.unit_id.is_(None),
                    User.role.in_(["attendant"])
                )
            )
            global_users = list(global_users_res.scalars().all())
            user_load = []
            for u in global_users:
                count_res = await self.db.execute(
                    select(func.count(Lead.id)).where(
                        Lead.current_attendant_id == u.id,
                        Lead.status.in_(["assigned", "in_progress"])
                    )
                )
                cnt = count_res.scalar() or 0
                if cnt < u.max_simultaneous_leads:
                    last_assigned = u.last_assigned_at or datetime.min.replace(tzinfo=timezone.utc)
                    user_load.append((cnt, last_assigned, u))
            if user_load:
                user_load.sort(key=lambda x: (x[0], x[1]))
                selected_user = user_load[0][2]

        if not selected_user:
            lead.status = "new"
            return None

        # Aplica a atribuição do lead
        if target_unit:
            lead.unit_id = target_unit.id
            target_unit.last_assigned_at = now

        lead.current_attendant_id = selected_user.id
        lead.status = "assigned"
        lead.assigned_at = now
        selected_user.last_assigned_at = now

        # Registra histórico de atribuição
        assignment = LeadAssignment(
            lead_id=lead.id,
            attendant_id=selected_user.id,
            status="active",
            assigned_at=now
        )
        self.db.add(assignment)
        return selected_user

    async def get_lead_by_id(self, lead_id: UUID, current_user: Optional[User] = None) -> Optional[Lead]:
        query = select(Lead).options(selectinload(Lead.current_attendant), selectinload(Lead.unit)).where(Lead.id == lead_id)
        if current_user:
            if current_user.role == "manager":
                managed_unit_ids = [u.id for u in current_user.managed_units] if current_user.managed_units else []
                if managed_unit_ids:
                    query = query.outerjoin(User, Lead.current_attendant_id == User.id).where(
                        or_(
                            Lead.unit_id.in_(managed_unit_ids),
                            User.unit_id.in_(managed_unit_ids)
                        )
                    )
                else:
                    return None
            elif current_user.role == "supervisor":
                if current_user.unit_id:
                    query = query.outerjoin(User, Lead.current_attendant_id == User.id).where(
                        or_(
                            Lead.unit_id == current_user.unit_id,
                            User.unit_id == current_user.unit_id
                        )
                    )
            elif current_user.role == "attendant":
                query = query.where(Lead.current_attendant_id == current_user.id)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_leads(
        self,
        page: int = 1,
        limit: int = 10,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        attendant_id: Optional[UUID] = None,
        current_user: Optional[User] = None
    ) -> Tuple[List[Lead], int]:
        query = select(Lead).options(selectinload(Lead.current_attendant), selectinload(Lead.unit))

        # Role-based filtering
        if current_user:
            if current_user.role == "manager":
                managed_unit_ids = [u.id for u in current_user.managed_units] if current_user.managed_units else []
                if managed_unit_ids:
                    query = query.outerjoin(User, Lead.current_attendant_id == User.id).where(
                        or_(
                            Lead.unit_id.in_(managed_unit_ids),
                            User.unit_id.in_(managed_unit_ids)
                        )
                    )
                else:
                    query = query.where(False)
            elif current_user.role == "supervisor":
                if current_user.unit_id:
                    query = query.outerjoin(User, Lead.current_attendant_id == User.id).where(
                        or_(
                            Lead.unit_id == current_user.unit_id,
                            User.unit_id == current_user.unit_id
                        )
                    )
            elif current_user.role == "attendant":
                query = query.where(Lead.current_attendant_id == current_user.id)
            # admin has no restrictions

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

    async def process_pending_unassigned_leads(self, limit: int = 50) -> int:
        result = await self.db.execute(
            select(Lead)
            .where(Lead.status == "new")
            .order_by(Lead.created_at.asc())
            .limit(limit)
        )
        pending_leads = list(result.scalars().all())
        if not pending_leads:
            return 0

        assigned_count = 0
        for lead in pending_leads:
            assigned_user = await self.distribute_lead(lead)
            if assigned_user:
                assigned_count += 1
                await self.db.flush()
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

                try:
                    from app.workers.sla_tasks import check_lead_sla_timeout
                    check_lead_sla_timeout.apply_async(
                        args=[str(lead.id)],
                        countdown=15 * 60
                    )
                except Exception as e:
                    pass

        if assigned_count > 0:
            await self.db.commit()

        return assigned_count

    async def update_status(self, lead_id: UUID, new_status: str) -> Optional[Lead]:
        lead = await self.get_lead_by_id(lead_id)
        if not lead:
            return None
        
        old_status = lead.status
        lead.status = new_status
        lead.last_interaction_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(lead)

        if old_status in ["assigned", "in_progress"] and new_status not in ["assigned", "in_progress"]:
            await self.process_pending_unassigned_leads(limit=10)

        return lead

    async def update_details(self, lead_id: UUID, details) -> Optional[Lead]:
        lead = await self.get_lead_by_id(lead_id)
        if not lead:
            return None

        if details.notes is not None:
            lead.notes = details.notes
        if details.verified_cpf is not None:
            lead.verified_cpf = details.verified_cpf
        if details.proposal_number is not None:
            lead.proposal_number = details.proposal_number

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
