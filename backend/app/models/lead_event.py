import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class LeadEvent(Base):
    """
    Tabela de eventos cronológicos (Timeline/Auditoria) do Lead.
    Registra toda e qualquer mudança de estado no ciclo de vida do Lead:
    - Entrada / Criação
    - Envio para o Balde / Captura do Balde
    - Atribuições e Reatribuições
    - Revelação de contato
    - Tabulações
    - Estouros de SLA / Retorno ao Balde
    """
    __tablename__ = "lead_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # 'lead_created', 'sent_to_bucket', 'claimed_from_bucket', 'assigned', 
    # 'reassigned', 'revealed', 'tabulated', 'sla_breached'
    event_type = Column(String(50), nullable=False, index=True)
    
    attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    attendant_name = Column(String(255), nullable=True)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_metadata = Column(JSON, nullable=True, default=dict)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    attendant = relationship("User", foreign_keys=[attendant_id])
