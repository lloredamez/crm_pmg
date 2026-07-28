from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.user import UserResponse

class LeadBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=8, max_length=50)
    email: Optional[str] = None
    meta_lead_id: Optional[str] = None
    campaign_name: Optional[str] = None
    status: str = Field(default="new", pattern="^(new|assigned|in_progress|converted|lost|expired)$")

class LeadCreate(LeadBase):
    pass

class LeadUpdateStatus(BaseModel):
    status: str = Field(..., pattern="^(new|assigned|in_progress|converted|lost|expired)$")

class LeadReassign(BaseModel):
    attendant_id: UUID

class BulkReassignRequest(BaseModel):
    lead_ids: List[UUID]
    attendant_id: UUID

class LeadResponse(LeadBase):
    id: UUID
    current_attendant_id: Optional[UUID] = None
    current_attendant: Optional[UserResponse] = None
    assigned_at: Optional[datetime] = None
    last_interaction_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LeadPaginationResponse(BaseModel):
    items: List[LeadResponse]
    total: int
    page: int
    limit: int
    pages: int
