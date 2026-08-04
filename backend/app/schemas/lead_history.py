from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class LeadHistoryItem(BaseModel):
    id: UUID
    lead_id: UUID
    event_type: str = "assignment"  # 'assignment' ou 'tabulation'
    attendant_id: Optional[UUID] = None
    attendant_name: str
    attendant_email: str
    status: str  # 'active', 'expired_timeout', 'disposition_timeout', 'manually_reassigned', 'completed', 'tabulated'
    assigned_at: datetime
    unassigned_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    disposition_name: Optional[str] = None
    disposition_notes: Optional[str] = None


    class Config:

        from_attributes = True
