import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class LeadAssignment(Base):
    __tablename__ = "lead_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), nullable=False) # 'active', 'expired_timeout', 'manually_reassigned', 'completed'
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    unassigned_at = Column(DateTime(timezone=True), nullable=True)

    lead = relationship("Lead", back_populates="assignments")
    attendant = relationship("User", back_populates="assignments")
