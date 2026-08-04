import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class ChannelDispositionSla(Base):
    __tablename__ = "channel_disposition_slas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=False)
    disposition_id = Column(UUID(as_uuid=True), ForeignKey("dispositions.id", ondelete="CASCADE"), nullable=False)
    timeout_minutes = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    channel = relationship("Channel", back_populates="disposition_slas")
    disposition = relationship("Disposition", back_populates="channel_slas")

    __table_args__ = (
        UniqueConstraint("channel_id", "disposition_id", name="uq_channel_disposition_sla"),
    )
