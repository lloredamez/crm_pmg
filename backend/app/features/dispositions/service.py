from uuid import UUID
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.disposition import Disposition
from app.models.lead import Lead
from app.models.lead_assignment import LeadAssignment
from app.models.channel import Channel
from app.models.channel_disposition_sla import ChannelDispositionSla
from app.models.lead_tabulation import LeadTabulation
from app.schemas.disposition import DispositionCreate, DispositionUpdate, LeadTabulateRequest, ChannelDispositionSlaCreate




class DispositionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_dispositions(self, active_only: bool = False) -> List[Disposition]:
        query = select(Disposition).order_by(Disposition.category.asc(), Disposition.name.asc())
        if active_only:
            query = query.where(Disposition.is_active.is_(True))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_disposition_by_id(self, disposition_id: UUID) -> Optional[Disposition]:
        result = await self.db.execute(select(Disposition).where(Disposition.id == disposition_id))
        return result.scalar_one_or_none()

    async def create_disposition(self, disposition_in: DispositionCreate) -> Disposition:
        disposition = Disposition(
            name=disposition_in.name,
            category=disposition_in.category,
            has_timeout=disposition_in.has_timeout,
            timeout_minutes=disposition_in.timeout_minutes if disposition_in.has_timeout else None,
            is_active=disposition_in.is_active
        )
        self.db.add(disposition)
        await self.db.commit()
        await self.db.refresh(disposition)
        return disposition

    async def update_disposition(self, disposition_id: UUID, disposition_in: DispositionUpdate) -> Optional[Disposition]:
        disposition = await self.get_disposition_by_id(disposition_id)
        if not disposition:
            return None

        if disposition_in.name is not None:
            disposition.name = disposition_in.name
        if disposition_in.category is not None:
            disposition.category = disposition_in.category
        if disposition_in.has_timeout is not None:
            disposition.has_timeout = disposition_in.has_timeout
        if disposition_in.timeout_minutes is not None:
            disposition.timeout_minutes = disposition_in.timeout_minutes if disposition.has_timeout else None
        if disposition_in.is_active is not None:
            disposition.is_active = disposition_in.is_active

        await self.db.commit()
        await self.db.refresh(disposition)
        return disposition

    async def toggle_active(self, disposition_id: UUID) -> Optional[Disposition]:
        disposition = await self.get_disposition_by_id(disposition_id)
        if not disposition:
            return None
        disposition.is_active = not disposition.is_active
        await self.db.commit()
        await self.db.refresh(disposition)
        return disposition

    async def delete_disposition(self, disposition_id: UUID) -> bool:
        disposition = await self.get_disposition_by_id(disposition_id)
        if not disposition:
            return False
        await self.db.delete(disposition)
        await self.db.commit()
        return True

    async def tabulate_lead(self, lead_id: UUID, tabulate_in: LeadTabulateRequest) -> Optional[Lead]:
        disposition = await self.get_disposition_by_id(tabulate_in.disposition_id)
        if not disposition:
            return None

        query = select(Lead).options(
            selectinload(Lead.current_attendant),
            selectinload(Lead.unit),
            selectinload(Lead.disposition),
            selectinload(Lead.assignments)
        ).where(Lead.id == lead_id)
        result = await self.db.execute(query)
        lead = result.scalar_one_or_none()

        if not lead:
            return None

        # Impedir retabulação se o lead já estiver no final do fluxo (Venda ou Perda)
        if lead.status in ["converted", "lost"]:
            raise HTTPException(
                status_code=400,
                detail="Este lead já atingiu o final do fluxo (Venda ou Perda) e não pode mais ser tabulado."
            )
        if lead.disposition and lead.disposition.category:
            current_cat = lead.disposition.category.lower()
            if any(term in current_cat for term in ["venda", "perda", "sucesso", "fechado", "sem interesse"]):
                raise HTTPException(
                    status_code=400,
                    detail="Este lead já atingiu o final do fluxo (Venda ou Perda) e não pode mais ser tabulado."
                )

        now = datetime.now(timezone.utc)
        lead.disposition_id = disposition.id
        lead.dispositioned_at = now

        # Update status based on category if applicable
        cat_lower = disposition.category.lower()
        if "venda" in cat_lower or "sucesso" in cat_lower or "fechado" in cat_lower:
            lead.status = "converted"
        elif "perda" in cat_lower or "sem interesse" in cat_lower:
            lead.status = "lost"
        elif lead.status == "new":
            lead.status = "assigned"

        # Calculate disposition_timeout_at (check custom channel SLA first, then fallback to disposition timeout)
        effective_timeout = None
        if disposition.has_timeout:
            if lead.channel_code:
                chan_res = await self.db.execute(select(Channel).where(Channel.code == lead.channel_code))
                channel_obj = chan_res.scalar_one_or_none()
                if channel_obj:
                    override_res = await self.db.execute(
                        select(ChannelDispositionSla).where(
                            ChannelDispositionSla.channel_id == channel_obj.id,
                            ChannelDispositionSla.disposition_id == disposition.id
                        )
                    )
                    sla_override = override_res.scalar_one_or_none()
                    if sla_override and sla_override.timeout_minutes > 0:
                        effective_timeout = sla_override.timeout_minutes

            if effective_timeout is None and disposition.timeout_minutes and disposition.timeout_minutes > 0:
                effective_timeout = disposition.timeout_minutes

        if effective_timeout:
            lead.disposition_timeout_at = now + timedelta(minutes=effective_timeout)
        else:
            lead.disposition_timeout_at = None

        if tabulate_in.notes:
            existing_notes = lead.notes or ""
            timestamp_str = now.strftime("%d/%m/%Y %H:%M")
            new_note_entry = f"[{timestamp_str} - Tabulação: {disposition.name}]\n{tabulate_in.notes}"
            lead.notes = f"{existing_notes}\n\n{new_note_entry}".strip()

        # Registrar evento no histórico de tabulações imutável
        tabulation_entry = LeadTabulation(
            lead_id=lead.id,
            attendant_id=lead.current_attendant_id,
            disposition_id=disposition.id,
            disposition_name=disposition.name,
            disposition_notes=tabulate_in.notes,
            created_at=now
        )
        self.db.add(tabulation_entry)

        # Atualizar atribuição ativa para referência rápida
        if lead.current_attendant_id:
            await self.db.execute(
                update(LeadAssignment)
                .where(
                    LeadAssignment.lead_id == lead.id,
                    LeadAssignment.attendant_id == lead.current_attendant_id,
                    LeadAssignment.status == "active"
                )
                .values(
                    disposition_name=disposition.name,
                    disposition_notes=tabulate_in.notes
                )
            )

        lead.last_interaction_at = now
        await self.db.commit()
        await self.db.refresh(lead)


        # Trigger WebSocket update event
        try:
            from app.core.socket_manager import emit_lead_reassigned
            lead_dict = {
                "id": str(lead.id),
                "name": lead.name,
                "phone": lead.phone,
                "status": lead.status,
                "disposition_name": disposition.name,
                "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                "attendant_name": lead.current_attendant.name if lead.current_attendant else ""
            }
            await emit_lead_reassigned(
                str(lead.current_attendant_id) if lead.current_attendant_id else "",
                str(lead.current_attendant_id) if lead.current_attendant_id else "",
                lead_dict
            )
        except Exception:
            pass

        return lead

    async def list_channel_slas(self, channel_id: Optional[UUID] = None) -> List[ChannelDispositionSla]:
        query = select(ChannelDispositionSla)
        if channel_id:
            query = query.where(ChannelDispositionSla.channel_id == channel_id)
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def upsert_channel_sla(self, sla_in: ChannelDispositionSlaCreate) -> ChannelDispositionSla:
        query = select(ChannelDispositionSla).where(
            ChannelDispositionSla.channel_id == sla_in.channel_id,
            ChannelDispositionSla.disposition_id == sla_in.disposition_id
        )
        res = await self.db.execute(query)
        existing = res.scalar_one_or_none()

        if existing:
            existing.timeout_minutes = sla_in.timeout_minutes
            sla_obj = existing
        else:
            sla_obj = ChannelDispositionSla(
                channel_id=sla_in.channel_id,
                disposition_id=sla_in.disposition_id,
                timeout_minutes=sla_in.timeout_minutes
            )
            self.db.add(sla_obj)

        await self.db.commit()
        await self.db.refresh(sla_obj)
        return sla_obj

    async def delete_channel_sla(self, sla_id: UUID) -> bool:
        res = await self.db.execute(select(ChannelDispositionSla).where(ChannelDispositionSla.id == sla_id))
        sla_obj = res.scalar_one_or_none()
        if not sla_obj:
            return False
        await self.db.delete(sla_obj)
        await self.db.commit()
        return True

