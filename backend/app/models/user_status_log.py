import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserStatusLog(Base):
    """
    Registro histórico de alterações de status de atividade do consultor
    (online, offline/indisponível, busy/ocupado) para auditoria e cálculo de jornada.
    """
    __tablename__ = "user_status_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False, index=True)  # 'online', 'offline', 'busy'
    source = Column(String(50), nullable=False, default="manual")  # 'login', 'manual', 'inactivity_timeout', 'deactivated', 'created'
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])
