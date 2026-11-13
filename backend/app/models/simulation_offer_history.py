import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class SimulationOfferHistory(Base):
    """
    Tabela de histórico de eventos de uma cotação/oferta de crédito.
    Registra quem criou a cotação, quem reprocessou e alterações de estado.
    """
    __tablename__ = "simulation_offer_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    simulation_offer_id = Column(UUID(as_uuid=True), ForeignKey("simulation_offers.id", ondelete="CASCADE"), nullable=False, index=True)
    simulation_lead_id = Column(UUID(as_uuid=True), ForeignKey("simulation_leads.id", ondelete="CASCADE"), nullable=False, index=True)

    # 'created' (Criação), 'reprocessed' (Reprocessamento), etc.
    action = Column(String(50), nullable=False, default="created", index=True)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_name = Column(String(255), nullable=True)

    custom_fields = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relacionamentos
    offer = relationship("SimulationOffer", back_populates="history")
    lead = relationship("SimulationLead")
    user = relationship("User", foreign_keys=[user_id])

