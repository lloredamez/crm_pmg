from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class DispositionBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    category: str = Field(default="Negociação", min_length=2, max_length=100)
    has_timeout: bool = Field(default=True)
    timeout_minutes: Optional[float] = Field(default=None, gt=0)
    is_active: bool = Field(default=True)

class DispositionCreate(DispositionBase):
    pass

class DispositionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    has_timeout: Optional[bool] = None
    timeout_minutes: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None

class DispositionResponse(DispositionBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class LeadTabulateRequest(BaseModel):
    disposition_id: UUID
    notes: Optional[str] = None
