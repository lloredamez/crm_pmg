import logging
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_status_log import UserStatusLog

logger = logging.getLogger(__name__)


async def record_user_status_change(
    db: AsyncSession,
    user_id: UUID,
    previous_status: Optional[str],
    new_status: str,
    source: str = "manual",
    changed_at: Optional[datetime] = None,
) -> Optional[UserStatusLog]:
    """
    Registra uma transição de status do consultor (online, offline, busy)
    para auditoria e cálculo de tempo online na jornada de trabalho.
    """
    try:
        if previous_status == new_status:
            return None
        entry = UserStatusLog(
            user_id=user_id,
            previous_status=previous_status,
            new_status=new_status,
            source=source,
            changed_at=changed_at or datetime.now(timezone.utc),
        )
        db.add(entry)
        return entry
    except Exception as e:
        logger.error(f"Erro ao registrar log de status do usuário {user_id}: {e}", exc_info=True)
        return None
