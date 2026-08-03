import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

user_units = Table(
    "user_units",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("unit_id", UUID(as_uuid=True), ForeignKey("units.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="attendant", nullable=False)  # 'admin', 'manager', 'supervisor', 'attendant'
    status = Column(String(50), default="offline", nullable=False) # 'online', 'offline', 'busy'
    max_simultaneous_leads = Column(Integer, default=10, nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), nullable=True)
    last_assigned_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    unit = relationship("Unit", back_populates="users")
    managed_units = relationship("Unit", secondary=user_units, back_populates="managers")
    assigned_leads = relationship("Lead", back_populates="current_attendant", foreign_keys="[Lead.current_attendant_id]")
    assignments = relationship("LeadAssignment", back_populates="attendant")
    messages = relationship("Message", back_populates="attendant")
    sla_breaches = relationship("SlaBreach", back_populates="attendant")


    @property
    def managed_unit_ids(self):
        from sqlalchemy import inspect
        state = inspect(self)
        if state and "managed_units" not in state.unloaded:
            return [u.id for u in self.managed_units] if self.managed_units else []
        return []



