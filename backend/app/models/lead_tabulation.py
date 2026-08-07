import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, foreign
from app.core.database import Base

class LeadTabulation(Base):
    __tablename__ = "lead_tabulations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), nullable=False)
    attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    disposition_id = Column(UUID(as_uuid=True), ForeignKey("dispositions.id", ondelete="SET NULL"), nullable=True)
    disposition_name = Column(String(255), nullable=False)
    disposition_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    lead = relationship("Lead", primaryjoin="foreign(LeadTabulation.lead_id) == Lead.id", back_populates="tabulations")
    attendant = relationship("User", back_populates="tabulations")
    disposition = relationship("Disposition", back_populates="tabulations")
