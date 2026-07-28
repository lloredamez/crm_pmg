from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class MessageBase(BaseModel):
    lead_id: UUID
    direction: str = Field(..., pattern="^(inbound|outbound)$")
    content: str = Field(..., min_length=1)

class MessageCreate(MessageBase):
    attendant_id: Optional[UUID] = None

class MessageResponse(MessageBase):
    id: UUID
    attendant_id: Optional[UUID] = None
    status: str
    external_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
