from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.user import UserResponse
from app.schemas.lead import UnitNestedResponse

class SlaBreachResponse(BaseModel):
    id: UUID
    lead_id: UUID
    attendant_id: Optional[UUID] = None
    unit_id: Optional[UUID] = None
    breach_type: str
    target_sla_minutes: Optional[float] = None
    action_taken: str
    breached_at: datetime

    attendant: Optional[UserResponse] = None
    unit: Optional[UnitNestedResponse] = None

    class Config:
        from_attributes = True

class SlaBreachPaginationResponse(BaseModel):
    items: List[SlaBreachResponse]
    total: int
    page: int
    limit: int
    pages: int
