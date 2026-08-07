import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class SlaBreach(Base):
    __tablename__ = "sla_breaches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), nullable=False)
    attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), nullable=True)
    breach_type = Column(String(50), nullable=False)  # 'first_contact_timeout', 'disposition_timeout'
    target_sla_minutes = Column(Float, nullable=True)
    action_taken = Column(String(100), nullable=False)  # 'reallocated', 'marked_expired'
    breached_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    attendant = relationship("User", back_populates="sla_breaches")
    unit = relationship("Unit", back_populates="sla_breaches")
