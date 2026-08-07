import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Integer, Float

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, foreign
from app.core.database import Base

class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    cpf = Column(String(14), nullable=True)
    verified_cpf = Column(String(14), nullable=True)
    proposal_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    email = Column(String(255), nullable=True)
    meta_lead_id = Column(String(255), nullable=True, index=True)
    campaign_name = Column(String(255), nullable=True)
    product_name = Column(String(255), nullable=True)
    channel_code = Column(String(50), nullable=True, index=True)

    prazo = Column(Integer, nullable=True)
    margem = Column(Float, nullable=True)
    valor_liberado = Column(Float, nullable=True)
    banco = Column(String(100), nullable=True)
    tabela = Column(String(100), nullable=True)

    status = Column(String(50), default="new", nullable=False) # 'new', 'assigned', 'in_progress', 'converted', 'lost', 'expired'
    is_revealed = Column(Boolean, default=False, nullable=False)
    revealed_at = Column(DateTime(timezone=True), nullable=True)
    current_attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), nullable=True)
    disposition_id = Column(UUID(as_uuid=True), ForeignKey("dispositions.id", ondelete="SET NULL"), nullable=True)
    dispositioned_at = Column(DateTime(timezone=True), nullable=True)
    disposition_timeout_at = Column(DateTime(timezone=True), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    last_interaction_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    unit = relationship("Unit", back_populates="leads")
    disposition = relationship("Disposition", back_populates="leads")
    current_attendant = relationship("User", back_populates="assigned_leads", foreign_keys=[current_attendant_id])
    assignments = relationship("LeadAssignment", primaryjoin="Lead.id == foreign(LeadAssignment.lead_id)", back_populates="lead", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="lead", cascade="all, delete-orphan")
    sla_breaches = relationship("SlaBreach", primaryjoin="Lead.id == foreign(SlaBreach.lead_id)", back_populates="lead", cascade="all, delete-orphan")
    tabulations = relationship("LeadTabulation", primaryjoin="Lead.id == foreign(LeadTabulation.lead_id)", back_populates="lead", cascade="all, delete-orphan")

    @property
    def current_disposition_name(self) -> Optional[str]:
        try:
            if self.assignments:
                for a in self.assignments:
                    if a.status == "active":
                        return a.disposition_name
        except Exception:
            pass
        return None

    @property
    def unassigned_sla_minutes(self) -> float:
        return getattr(self, "_unassigned_sla_minutes", 15.0)

    @unassigned_sla_minutes.setter
    def unassigned_sla_minutes(self, val: float):
        self._unassigned_sla_minutes = val



