import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    cpf = Column(String(14), nullable=True)
    email = Column(String(255), nullable=True)
    meta_lead_id = Column(String(255), nullable=True, index=True)
    campaign_name = Column(String(255), nullable=True)
    status = Column(String(50), default="new", nullable=False) # 'new', 'assigned', 'in_progress', 'converted', 'lost', 'expired'
    current_attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    last_interaction_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    unit = relationship("Unit", back_populates="leads")
    current_attendant = relationship("User", back_populates="assigned_leads", foreign_keys=[current_attendant_id])
    assignments = relationship("LeadAssignment", back_populates="lead", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="lead", cascade="all, delete-orphan")
