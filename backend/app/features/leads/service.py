from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import selectinload
from app.models.lead import Lead
from app.models.bucket_lead import BucketLead
from app.models.user import User
from app.models.lead_assignment import LeadAssignment
from app.models.sla_breach import SlaBreach
from app.models.lead_tabulation import LeadTabulation
from app.models.channel import Channel
from app.schemas.lead import LeadCreate, LeadUpdateStatus


from app.core.socket_manager import emit_lead_assigned, emit_lead_reassigned

class LeadService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_and_assign_lead(self, lead_in: LeadCreate):
        assigned_user = None
        primary_unit_id: Optional[UUID] = None

        if lead_in.channel_code and lead_in.channel_code.strip():
            code_clean = lead_in.channel_code.strip()
            chan_res = await self.db.execute(
                select(Channel)
                .options(selectinload(Channel.units))
                .where(func.lower(Channel.code) == func.lower(code_clean))
            )
            chan = chan_res.scalar_one_or_none()
            if chan:
                if chan.units:
                    target_unit_ids = [u.id for u in chan.units]
                    primary_unit_id = target_unit_ids[0]
                    assigned_user = await self._find_eligible_attendant_for_units(target_unit_ids)
                else:
                    assigned_user = await self._find_eligible_attendant_for_units(None)
            else:
                if lead_in.unit_id:
                    primary_unit_id = lead_in.unit_id
                    assigned_user = await self._find_eligible_attendant_for_units([lead_in.unit_id])
                else:
                    assigned_user = await self._find_eligible_attendant_for_units(None)
        elif lead_in.unit_id:
            primary_unit_id = lead_in.unit_id
            assigned_user = await self._find_eligible_attendant_for_units([lead_in.unit_id])
        else:
            assigned_user = await self._find_eligible_attendant_for_units(None)

        if assigned_user:
            now = datetime.now(timezone.utc)
            lead = Lead(
                name=lead_in.name,
                phone=lead_in.phone,
                cpf=lead_in.cpf,
                verified_cpf=lead_in.verified_cpf,
                proposal_number=lead_in.proposal_number,
                notes=lead_in.notes,
                email=lead_in.email,
                meta_lead_id=lead_in.meta_lead_id,
                campaign_name=lead_in.campaign_name,
                product_name=lead_in.product_name or lead_in.product,
                channel_code=lead_in.channel_code,
                prazo=lead_in.prazo,
                margem=lead_in.margem,
                valor_liberado=lead_in.valor_liberado,
                banco=lead_in.banco,
                tabela=lead_in.tabela,
                status="assigned",
                current_attendant_id=assigned_user.id,
                assigned_at=now,
                unit_id=assigned_user.unit_id
            )
            self.db.add(lead)
            await self.db.flush()

            assigned_user.last_assigned_at = now
            assignment = LeadAssignment(
                lead_id=lead.id,
                attendant_id=assigned_user.id,
                status="active",
                assigned_at=now
            )
            self.db.add(assignment)
            await self.db.commit()
            await self.db.refresh(lead)

            try:
                from app.core.socket_manager import emit_lead_assigned
                lead_dict = {
                    "id": str(lead.id),
                    "name": lead.name,
                    "phone": lead.phone,
                    "email": lead.email,
                    "campaign_name": lead.campaign_name,
                    "status": lead.status,
                    "created_at": lead.created_at.isoformat() if lead.created_at else None,
                    "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                    "attendant_name": assigned_user.name,
                }
                await emit_lead_assigned(str(assigned_user.id), lead_dict)
            except Exception:
                pass

            return lead
        else:
            bucket_lead = BucketLead(
                name=lead_in.name,
                phone=lead_in.phone,
                cpf=lead_in.cpf,
                verified_cpf=lead_in.verified_cpf,
                proposal_number=lead_in.proposal_number,
                notes=lead_in.notes,
                email=lead_in.email,
                meta_lead_id=lead_in.meta_lead_id,
                campaign_name=lead_in.campaign_name,
                product_name=lead_in.product_name or lead_in.product,
                channel_code=lead_in.channel_code,
                prazo=lead_in.prazo,
                margem=lead_in.margem,
                valor_liberado=lead_in.valor_liberado,
                banco=lead_in.banco,
                tabela=lead_in.tabela,
                unit_id=primary_unit_id,
            )
            self.db.add(bucket_lead)
            await self.db.commit()
            await self.db.refresh(bucket_lead)

            try:
                from app.core.socket_manager import emit_lead_updated
                lead_dict = {
                    "id": str(bucket_lead.id),
                    "name": bucket_lead.name,
                    "phone": bucket_lead.phone,
                    "email": bucket_lead.email,
                    "campaign_name": bucket_lead.campaign_name,
                    "status": "new",
                    "created_at": bucket_lead.created_at.isoformat() if bucket_lead.created_at else None,
                }
                await emit_lead_updated(lead_dict)
            except Exception:
                pass

            return bucket_lead

    async def _find_eligible_attendant_for_units(self, unit_ids: Optional[List[UUID]] = None, exclude_user_id: Optional[UUID] = None) -> Optional[User]:
        query = select(User).where(
            User.status == "online",
            User.role.in_(["attendant"])
        )
        if unit_ids:
            query = query.where(User.unit_id.in_(unit_ids))
        if exclude_user_id:
            query = query.where(User.id != exclude_user_id)

        result = await self.db.execute(query)
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

        # Ordena estritamente por quem recebeu lead há mais tempo (Round-Robin puro)
        user_load.sort(key=lambda x: (x[1], x[0]))
        return user_load[0][2]

    async def _find_eligible_attendant_for_unit(self, unit_id: Optional[UUID] = None, exclude_user_id: Optional[UUID] = None) -> Optional[User]:
        unit_ids = [unit_id] if unit_id else None
        return await self._find_eligible_attendant_for_units(unit_ids, exclude_user_id=exclude_user_id)

    async def distribute_lead(self, lead: Lead, exclude_user_id: Optional[UUID] = None) -> Optional[User]:
        selected_user = None
        if lead.unit_id:
            selected_user = await self._find_eligible_attendant_for_units([lead.unit_id], exclude_user_id=exclude_user_id)
        elif lead.channel_code and lead.channel_code.strip():
            chan_res = await self.db.execute(
                select(Channel)
                .options(selectinload(Channel.units))
                .where(func.lower(Channel.code) == func.lower(lead.channel_code.strip()))
            )
            chan = chan_res.scalar_one_or_none()
            if chan and chan.units:
                unit_ids = [u.id for u in chan.units]
                selected_user = await self._find_eligible_attendant_for_units(unit_ids, exclude_user_id=exclude_user_id)

        if not selected_user and not lead.unit_id and not lead.channel_code:
            selected_user = await self._find_eligible_attendant_for_units(None, exclude_user_id=exclude_user_id)

        if not selected_user:
            lead.status = "new"
            lead.current_attendant_id = None
            return None

        now = datetime.now(timezone.utc)
        lead.current_attendant_id = selected_user.id
        lead.status = "assigned"
        lead.assigned_at = now
        if not lead.unit_id and selected_user.unit_id:
            lead.unit_id = selected_user.unit_id

        selected_user.last_assigned_at = now

        assignment = LeadAssignment(
            lead_id=lead.id,
            attendant_id=selected_user.id,
            status="active",
            assigned_at=now
        )
        self.db.add(assignment)
        return selected_user

    async def get_lead_by_id(self, lead_id: UUID, current_user: Optional[User] = None):
        query = select(Lead).options(selectinload(Lead.current_attendant), selectinload(Lead.unit), selectinload(Lead.disposition)).where(Lead.id == lead_id)
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

        from app.features.dispositions.service import DispositionService
        unassigned_sla = await DispositionService(self.db).get_unassigned_sla_minutes()

        result = await self.db.execute(query)
        lead = result.scalar_one_or_none()
        if lead:
            lead.unassigned_sla_minutes = unassigned_sla
            return lead

        b_res = await self.db.execute(select(BucketLead).options(selectinload(BucketLead.unit)).where(BucketLead.id == lead_id))
        b_lead = b_res.scalar_one_or_none()
        if b_lead:
            b_lead.unassigned_sla_minutes = unassigned_sla
        return b_lead

    async def list_leads(
        self,
        page: int = 1,
        limit: int = 10,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        attendant_id: Optional[UUID] = None,
        banco_filter: Optional[str] = None,
        tabela_filter: Optional[str] = None,
        current_user: Optional[User] = None
    ) -> Tuple[List, int]:
        from app.features.dispositions.service import DispositionService
        unassigned_sla = await DispositionService(self.db).get_unassigned_sla_minutes()

        is_balde_filter = status_filter and status_filter.lower() in ["new", "balde"]

        if is_balde_filter:
            b_query = select(BucketLead).options(selectinload(BucketLead.unit))

            if current_user:
                if current_user.role == "manager":
                    managed_unit_ids = [u.id for u in current_user.managed_units] if current_user.managed_units else []
                    if managed_unit_ids:
                        b_query = b_query.where(or_(BucketLead.unit_id.is_(None), BucketLead.unit_id.in_(managed_unit_ids)))
                elif current_user.role == "supervisor":
                    if current_user.unit_id:
                        b_query = b_query.where(or_(BucketLead.unit_id.is_(None), BucketLead.unit_id == current_user.unit_id))

            if banco_filter and banco_filter.lower() != "all":
                b_query = b_query.where(BucketLead.banco.ilike(f"%{banco_filter}%"))

            if tabela_filter and tabela_filter.lower() != "all":
                b_query = b_query.where(BucketLead.tabela.ilike(f"%{tabela_filter}%"))

            if search:
                search_pattern = f"%{search}%"
                b_query = b_query.where(
                    or_(
                        BucketLead.name.ilike(search_pattern),
                        BucketLead.phone.ilike(search_pattern),
                        BucketLead.cpf.ilike(search_pattern),
                        BucketLead.verified_cpf.ilike(search_pattern),
                        BucketLead.email.ilike(search_pattern),
                        BucketLead.campaign_name.ilike(search_pattern),
                        BucketLead.banco.ilike(search_pattern),
                        BucketLead.tabela.ilike(search_pattern)
                    )
                )

            count_b_query = select(func.count()).select_from(b_query.subquery())
            total_res = await self.db.execute(count_b_query)
            total = total_res.scalar() or 0

            offset = (page - 1) * limit
            b_query = b_query.order_by(BucketLead.created_at.desc()).offset(offset).limit(limit)

            result = await self.db.execute(b_query)
            bucket_leads = list(result.scalars().all())
            for bl in bucket_leads:
                bl.unassigned_sla_minutes = unassigned_sla
            return bucket_leads, total

        query = select(Lead).options(
            selectinload(Lead.current_attendant),
            selectinload(Lead.unit),
            selectinload(Lead.disposition),
            selectinload(Lead.assignments)
        )

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

        if status_filter and status_filter.lower() != "all":
            query = query.where(Lead.status == status_filter.lower())

        if attendant_id:
            query = query.where(Lead.current_attendant_id == attendant_id)

        if banco_filter and banco_filter.lower() != "all":
            query = query.where(Lead.banco.ilike(f"%{banco_filter}%"))

        if tabela_filter and tabela_filter.lower() != "all":
            query = query.where(Lead.tabela.ilike(f"%{tabela_filter}%"))

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Lead.name.ilike(search_pattern),
                    Lead.phone.ilike(search_pattern),
                    Lead.cpf.ilike(search_pattern),
                    Lead.verified_cpf.ilike(search_pattern),
                    Lead.email.ilike(search_pattern),
                    Lead.campaign_name.ilike(search_pattern),
                    Lead.banco.ilike(search_pattern),
                    Lead.tabela.ilike(search_pattern)
                )
            )

        count_query = select(func.count()).select_from(query.subquery())
        total_res = await self.db.execute(count_query)
        total = total_res.scalar() or 0

        offset = (page - 1) * limit
        query = query.order_by(Lead.created_at.desc()).offset(offset).limit(limit)

        result = await self.db.execute(query)
        leads = list(result.scalars().all())
        for l in leads:
            l.unassigned_sla_minutes = unassigned_sla
        return leads, total

    async def process_pending_unassigned_leads(self, limit: int = 50) -> int:
        # Leads na tabela separada bucket_leads NUNCA são distribuídos pelo worker.
        # Eles só saem quando um atendente resgata manualmente ("Pegar Lead").
        return 0

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

        if hasattr(details, 'name') and details.name is not None:
            lead.name = details.name
        if hasattr(details, 'phone') and details.phone is not None:
            lead.phone = details.phone
        if details.notes is not None:
            lead.notes = details.notes
        if details.verified_cpf is not None:
            lead.verified_cpf = details.verified_cpf
        if details.proposal_number is not None:
            lead.proposal_number = details.proposal_number
        if details.prazo is not None:
            lead.prazo = details.prazo
        if details.margem is not None:
            lead.margem = details.margem
        if details.valor_liberado is not None:
            lead.valor_liberado = details.valor_liberado
        if details.banco is not None:
            lead.banco = details.banco
        if details.tabela is not None:
            lead.tabela = details.tabela

        lead.last_interaction_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(lead)
        return lead

    async def reveal_lead(self, lead_id: UUID) -> Optional[Lead]:
        from app.models.disposition import Disposition
        from datetime import timedelta

        query = select(Lead).options(
            selectinload(Lead.current_attendant),
            selectinload(Lead.unit),
            selectinload(Lead.disposition)
        ).where(Lead.id == lead_id)
        result = await self.db.execute(query)
        lead = result.scalar_one_or_none()

        if not lead:
            return None

        now = datetime.now(timezone.utc)
        lead.is_revealed = True
        lead.revealed_at = now

        # Tabulate as "Em Contato" if not dispositioned or if in initial state
        if not lead.disposition_id:
            disp_res = await self.db.execute(
                select(Disposition).where(
                    Disposition.is_active.is_(True),
                    or_(
                        Disposition.name.ilike("%Em Contato%"),
                        Disposition.name.ilike("%Contato%")
                    )
                )
            )
            disp = disp_res.scalars().first()
            if not disp:
                disp_res_any = await self.db.execute(select(Disposition).where(Disposition.is_active.is_(True)))
                disp = disp_res_any.scalars().first()

            if disp:
                lead.disposition_id = disp.id
                lead.dispositioned_at = now
                if disp.has_timeout and disp.timeout_minutes and disp.timeout_minutes > 0:
                    lead.disposition_timeout_at = now + timedelta(minutes=disp.timeout_minutes)

        if lead.status == "new":
            lead.status = "assigned"

        lead.last_interaction_at = now
        await self.db.commit()
        await self.db.refresh(lead)

        try:
            from app.core.socket_manager import emit_lead_updated
            lead_dict = {
                "id": str(lead.id),
                "name": lead.name,
                "phone": lead.phone,
                "status": lead.status,
                "is_revealed": lead.is_revealed,
                "disposition_name": lead.disposition.name if lead.disposition else "",
                "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                "attendant_name": lead.current_attendant.name if lead.current_attendant else ""
            }
            await emit_lead_updated(lead_dict)
        except Exception:
            pass

        return lead

    async def reassign_lead(self, lead_id: UUID, new_attendant_id: UUID, reason: str = "manually_reassigned") -> Optional[Lead]:
        lead = await self.get_lead_by_id(lead_id)
        if not lead:
            return None

        target_user = await self.db.get(User, new_attendant_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="Atendente destino não encontrado")
        if target_user.role != "attendant":
            raise HTTPException(status_code=400, detail="Não é permitido reatribuir leads para gerentes ou supervisores")

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

    async def claim_lead(self, lead_id: UUID, current_user: User) -> Lead:
        from fastapi import HTTPException

        bucket_lead = await self.db.get(BucketLead, lead_id)
        if bucket_lead:
            if current_user.role == "attendant":
                active_count_res = await self.db.execute(
                    select(func.count(Lead.id)).where(
                        Lead.current_attendant_id == current_user.id,
                        Lead.status.in_(["assigned", "in_progress"])
                    )
                )
                cnt = active_count_res.scalar() or 0
                if cnt >= current_user.max_simultaneous_leads:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Você já atingiu seu limite máximo de leads simultâneos ({current_user.max_simultaneous_leads}). Finalize um atendimento antes de pegar novos leads."
                    )

            now = datetime.now(timezone.utc)
            lead = Lead(
                id=bucket_lead.id,
                name=bucket_lead.name,
                phone=bucket_lead.phone,
                cpf=bucket_lead.cpf,
                verified_cpf=bucket_lead.verified_cpf,
                proposal_number=bucket_lead.proposal_number,
                notes=bucket_lead.notes,
                email=bucket_lead.email,
                meta_lead_id=bucket_lead.meta_lead_id,
                campaign_name=bucket_lead.campaign_name,
                product_name=bucket_lead.product_name,
                channel_code=bucket_lead.channel_code,
                prazo=bucket_lead.prazo,
                margem=bucket_lead.margem,
                valor_liberado=bucket_lead.valor_liberado,
                banco=bucket_lead.banco,
                tabela=bucket_lead.tabela,
                status="assigned",
                current_attendant_id=current_user.id,
                assigned_at=now,
                unit_id=current_user.unit_id or bucket_lead.unit_id,
                created_at=bucket_lead.created_at
            )

            await self.db.delete(bucket_lead)
            self.db.add(lead)

            current_user.last_assigned_at = now
            new_assignment = LeadAssignment(
                lead_id=lead.id,
                attendant_id=current_user.id,
                status="active",
                assigned_at=now
            )
            self.db.add(new_assignment)
            await self.db.commit()
            await self.db.refresh(lead)

            try:
                from app.workers.sla_tasks import check_lead_sla_timeout
                check_lead_sla_timeout.apply_async(
                    args=[str(lead.id)],
                    countdown=1 * 60
                )
            except Exception:
                pass

            try:
                lead_dict = {
                    "id": str(lead.id),
                    "name": lead.name,
                    "phone": lead.phone,
                    "email": lead.email,
                    "status": lead.status,
                    "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                    "attendant_name": current_user.name
                }
                await emit_lead_assigned(str(current_user.id), lead_dict)
            except Exception:
                pass

            return lead

        lead = await self.db.get(Lead, lead_id)
        if not lead:
            raise HTTPException(status_code=404, detail="Lead não encontrado")

        if lead.current_attendant_id is not None and lead.status not in ["new", "expired"]:
            raise HTTPException(status_code=400, detail="Este lead já está atribuído a outro atendente")

        # Checagem de capacidade caso o usuário seja atendente
        if current_user.role == "attendant":
            active_count_res = await self.db.execute(
                select(func.count(Lead.id)).where(
                    Lead.current_attendant_id == current_user.id,
                    Lead.status.in_(["assigned", "in_progress"])
                )
            )
            cnt = active_count_res.scalar() or 0
            if cnt >= current_user.max_simultaneous_leads:
                raise HTTPException(
                    status_code=400,
                    detail=f"Você já atingiu seu limite máximo de leads simultâneos ({current_user.max_simultaneous_leads}). Finalize um atendimento antes de pegar novos leads."
                )

        now = datetime.now(timezone.utc)
        lead.current_attendant_id = current_user.id
        lead.status = "assigned"
        lead.assigned_at = now
        current_user.last_assigned_at = now

        new_assignment = LeadAssignment(
            lead_id=lead.id,
            attendant_id=current_user.id,
            status="active",
            assigned_at=now
        )
        self.db.add(new_assignment)
        await self.db.commit()
        await self.db.refresh(lead)

        # Agenda a verificação de SLA para o lead resgatado
        try:
            from app.workers.sla_tasks import check_lead_sla_timeout
            check_lead_sla_timeout.apply_async(
                args=[str(lead.id)],
                countdown=1 * 60 # 1 min timeout
            )
        except Exception:
            pass

        # Dispara notificação via Socket
        try:
            lead_dict = {
                "id": str(lead.id),
                "name": lead.name,
                "phone": lead.phone,
                "email": lead.email,
                "status": lead.status,
                "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                "attendant_name": current_user.name
            }
            await emit_lead_assigned(str(current_user.id), lead_dict)
        except Exception:
            pass

        return lead

    async def list_sla_breaches(
        self,
        page: int = 1,
        limit: int = 10,
        attendant_id: Optional[UUID] = None,
        unit_id: Optional[UUID] = None,
        breach_type: Optional[str] = None
    ) -> Tuple[List[SlaBreach], int]:
        query = select(SlaBreach).options(
            selectinload(SlaBreach.attendant),
            selectinload(SlaBreach.unit)
        )

        if attendant_id:
            query = query.where(SlaBreach.attendant_id == attendant_id)
        if unit_id:
            query = query.where(SlaBreach.unit_id == unit_id)
        if breach_type:
            query = query.where(SlaBreach.breach_type == breach_type)

        count_query = select(func.count()).select_from(query.subquery())
        total_res = await self.db.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(SlaBreach.breached_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        items = list(result.scalars().all())

        return items, total

    async def get_lead_history(self, lead_id: UUID) -> List[dict]:
        # 1. Fetch assignments
        assign_query = (
            select(LeadAssignment)
            .options(selectinload(LeadAssignment.attendant))
            .where(LeadAssignment.lead_id == lead_id)
            .order_by(LeadAssignment.assigned_at.asc())
        )
        assign_res = await self.db.execute(assign_query)
        assignments = assign_res.scalars().all()

        # 2. Fetch tabulations
        tab_query = (
            select(LeadTabulation)
            .options(selectinload(LeadTabulation.attendant))
            .where(LeadTabulation.lead_id == lead_id)
            .order_by(LeadTabulation.created_at.asc())
        )
        tab_res = await self.db.execute(tab_query)
        tabulations = tab_res.scalars().all()

        events = []
        now = datetime.now(timezone.utc)

        # Set of attendant IDs who have performed at least one tabulation for this lead
        tabulated_attendant_ids = {t.attendant_id for t in tabulations if t.attendant_id}

        for assign in assignments:
            # Se a atribuição for a ativa e o atendente já realizou tabulações, omitir o card redundante de 'Em Atendimento/Em andamento'
            if assign.status == "active" and assign.attendant_id in tabulated_attendant_ids:
                continue

            end_time = assign.unassigned_at or (now if assign.status == "active" else None)
            duration = None
            if assign.assigned_at and end_time:
                duration = int((end_time - assign.assigned_at).total_seconds())

            events.append({
                "id": assign.id,
                "lead_id": assign.lead_id,
                "event_type": "assignment",
                "attendant_id": assign.attendant_id,
                "attendant_name": assign.attendant.name if assign.attendant else "Desconhecido",
                "attendant_email": assign.attendant.email if assign.attendant else "",
                "status": assign.status,
                "assigned_at": assign.assigned_at,
                "unassigned_at": assign.unassigned_at,
                "duration_seconds": duration,
                "disposition_name": None,
                "disposition_notes": None,
                "_timestamp": assign.assigned_at or now
            })

        for tab in tabulations:
            events.append({
                "id": tab.id,
                "lead_id": tab.lead_id,
                "event_type": "tabulation",
                "attendant_id": tab.attendant_id,
                "attendant_name": tab.attendant.name if tab.attendant else "Desconhecido",
                "attendant_email": tab.attendant.email if tab.attendant else "",
                "status": "tabulated",
                "assigned_at": tab.created_at,
                "unassigned_at": None,
                "duration_seconds": None,
                "disposition_name": tab.disposition_name,
                "disposition_notes": tab.disposition_notes,
                "_timestamp": tab.created_at or now
            })

        events.sort(key=lambda x: x["_timestamp"])
        for e in events:
            e.pop("_timestamp", None)

        return events





