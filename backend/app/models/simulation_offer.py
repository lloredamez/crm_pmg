import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class SimulationOffer(Base):
    """
    Tabela de histórico de simulações / propostas de crédito vinculadas a um Lead (CPF).
    Cada consulta ou variação de cálculo gera um registro nesta tabela.
    """
    __tablename__ = "simulation_offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    simulation_lead_id = Column(UUID(as_uuid=True), ForeignKey("simulation_leads.id", ondelete="CASCADE"), nullable=False, index=True)
    attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    valor_bruto = Column(Float, nullable=True)
    valor_liberado = Column(Float, nullable=True)
    parcela = Column(Integer, nullable=True)
    valor_parcela = Column(Float, nullable=True)
    taxa_juros = Column(Float, nullable=True)

    status = Column(String(50), nullable=False, default="pending", index=True)
    custom_fields = Column(JSON, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    # Relacionamentos diretos
    lead = relationship("SimulationLead", back_populates="offers")
    attendant = relationship("User", foreign_keys=[attendant_id])

    @property
    def quantidade_parcelas(self) -> Optional[int]:
        return self.parcela

    @quantidade_parcelas.setter
    def quantidade_parcelas(self, val: Optional[int]):
        self.parcela = val

