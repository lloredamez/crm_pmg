import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="attendant", nullable=False)  # 'admin', 'supervisor', 'attendant'
    status = Column(String(50), default="offline", nullable=False) # 'online', 'offline', 'busy'
    max_simultaneous_leads = Column(Integer, default=10, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    assigned_leads = relationship("Lead", back_populates="current_attendant", foreign_keys="[Lead.current_attendant_id]")
    assignments = relationship("LeadAssignment", back_populates="attendant")
    messages = relationship("Message", back_populates="attendant")
