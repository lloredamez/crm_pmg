from uuid import UUID
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.models.disposition import Disposition
from app.models.lead import Lead
from app.models.lead_assignment import LeadAssignment
from app.schemas.disposition import DispositionCreate, DispositionUpdate, LeadTabulateRequest


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
            if not disposition_in.has_timeout:
                disposition.timeout_minutes = None
        if disposition_in.timeout_minutes is not None and disposition.has_timeout:
            disposition.timeout_minutes = disposition_in.timeout_minutes
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
            selectinload(Lead.disposition)
        ).where(Lead.id == lead_id)
        result = await self.db.execute(query)
        lead = result.scalar_one_or_none()

        if not lead:
            return None

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

        # Calculate disposition_timeout_at if disposition has_timeout & timeout_minutes
        if disposition.has_timeout and disposition.timeout_minutes and disposition.timeout_minutes > 0:
            lead.disposition_timeout_at = now + timedelta(minutes=disposition.timeout_minutes)
        else:
            lead.disposition_timeout_at = None

        if tabulate_in.notes:
            existing_notes = lead.notes or ""
            timestamp_str = now.strftime("%d/%m/%Y %H:%M")
            new_note_entry = f"[{timestamp_str} - Tabulação: {disposition.name}]\n{tabulate_in.notes}"
            lead.notes = f"{existing_notes}\n\n{new_note_entry}".strip()

        # Registrar tabulação e notas no histórico de atribuição ativo
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
