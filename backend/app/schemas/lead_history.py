from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel

class LeadHistoryItem(BaseModel):
    id: UUID
    lead_id: UUID
    event_type: str # 'lead_created', 'sent_to_bucket', 'claimed_from_bucket', 'assigned', 'reassigned', 'revealed', 'tabulated', 'sla_breached'
    title: str
    description: Optional[str] = None
    attendant_id: Optional[UUID] = None
    attendant_name: Optional[str] = None
    attendant_email: Optional[str] = None
    status: Optional[str] = None
    created_at: datetime
    event_metadata: Optional[Dict[str, Any]] = None

    # Campos de compatibilidade legada com frontend atual
    assigned_at: Optional[datetime] = None
    unassigned_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    disposition_name: Optional[str] = None
    disposition_notes: Optional[str] = None

    class Config:
        from_attributes = True
