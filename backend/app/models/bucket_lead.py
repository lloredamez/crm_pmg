import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class BucketLead(Base):
    __tablename__ = "bucket_leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, default="-")
    phone = Column(String(50), nullable=True, default="")
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

    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    unit = relationship("Unit")

    @property
    def status(self) -> str:
        return "new"

    @property
    def unassigned_sla_minutes(self) -> float:
        return getattr(self, "_unassigned_sla_minutes", 15.0)

    @unassigned_sla_minutes.setter
    def unassigned_sla_minutes(self, val: float):
        self._unassigned_sla_minutes = val

    @property
    def is_revealed(self) -> bool:
        return False

    @property
    def current_attendant_id(self) -> Optional[UUID]:
        return None

    @property
    def current_attendant(self):
        return None

    @property
    def disposition_id(self) -> Optional[UUID]:
        return None

    @property
    def disposition(self):
        return None

    @property
    def current_disposition_name(self) -> Optional[str]:
        return None

    @property
    def dispositioned_at(self) -> Optional[datetime]:
        return None

    @property
    def disposition_timeout_at(self) -> Optional[datetime]:
        return None

    @property
    def revealed_at(self) -> Optional[datetime]:
        return None

    @property
    def assigned_at(self) -> Optional[datetime]:
        return None

    @property
    def last_interaction_at(self) -> Optional[datetime]:
        return None
