import logging
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.lead_event import LeadEvent
from app.models.user import User

logger = logging.getLogger(__name__)

async def record_lead_event(
    db: AsyncSession,
    lead_id: UUID,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    attendant_id: Optional[UUID] = None,
    attendant_name: Optional[str] = None,
    event_metadata: Optional[Dict[str, Any]] = None,
    created_at: Optional[datetime] = None
) -> LeadEvent:
    """
    Registra um evento imutável na timeline do lead.
    Resolve automaticamente o nome do atendente caso não seja fornecido e attendant_id esteja presente.
    """
    try:
        now = created_at or datetime.now(timezone.utc)
        resolved_attendant_name = attendant_name

        if attendant_id and not resolved_attendant_name:
            user_res = await db.execute(select(User.name).where(User.id == attendant_id))
            resolved_attendant_name = user_res.scalar_one_or_none()

        event = LeadEvent(
            lead_id=lead_id,
            event_type=event_type,
            attendant_id=attendant_id,
            attendant_name=resolved_attendant_name,
            title=title,
            description=description,
            event_metadata=event_metadata or {},
            created_at=now
        )
        db.add(event)
        return event
    except Exception as e:
        logger.error(f"Erro ao registrar evento de timeline para o lead {lead_id}: {e}", exc_info=True)
        # Não propaga erro para não interromper fluxos transacionais primários
        return None
