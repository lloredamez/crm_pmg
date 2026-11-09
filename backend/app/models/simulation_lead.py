import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class SimulationLead(Base):
    """
    Tabela exclusiva para leads gerados a partir do módulo de Simulações.
    Estes leads não possuem SLA, tabulações ou timeout de atendimento.
    """
    __tablename__ = "simulation_leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, default="Aguardando simulação...")
    phone = Column(String(50), nullable=True, default="")
    cpf = Column(String(14), nullable=True)
    verified_cpf = Column(String(14), nullable=True, index=True)

    prazo = Column(Integer, nullable=True)
    margem = Column(Float, nullable=True)
    valor_liberado = Column(Float, nullable=True)
    valor_parcela = Column(Float, nullable=True)
    banco = Column(String(100), nullable=True)
    tabela = Column(String(100), nullable=True)
    custom_fields = Column(JSON, nullable=True, default=dict)

    simulation_status = Column(String(50), nullable=False, default="pending", index=True)
    status = Column(String(50), nullable=False, default="assigned", index=True)

    current_attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), nullable=True, index=True)

    webhook_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    # Relacionamentos diretos
    unit = relationship("Unit")
    current_attendant = relationship("User", foreign_keys=[current_attendant_id])

    @property
    def quantidade_parcelas(self) -> Optional[int]:
        return self.prazo

    @quantidade_parcelas.setter
    def quantidade_parcelas(self, val: Optional[int]):
        self.prazo = val

