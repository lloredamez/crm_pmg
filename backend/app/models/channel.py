import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Table, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

unit_channels = Table(
    "unit_channels",
    Base.metadata,
    Column("unit_id", UUID(as_uuid=True), ForeignKey("units.id", ondelete="CASCADE"), primary_key=True),
    Column("channel_id", UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True),
)

channel_dispositions = Table(
    "channel_dispositions",
    Base.metadata,
    Column("channel_id", UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True),
    Column("disposition_id", UUID(as_uuid=True), ForeignKey("dispositions.id", ondelete="CASCADE"), primary_key=True),
)

class Channel(Base):
    __tablename__ = "channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    allowed_fields = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    units = relationship("Unit", secondary=unit_channels, back_populates="channels")
    dispositions = relationship("Disposition", secondary=channel_dispositions, back_populates="channels")
    disposition_slas = relationship("ChannelDispositionSla", back_populates="channel", cascade="all, delete-orphan")


