from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.unit import UnitResponse
from app.schemas.disposition import DispositionResponse

class ChannelBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    is_active: bool = Field(default=True)

class ChannelCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    is_active: bool = Field(default=True)
    unit_ids: Optional[List[UUID]] = Field(default_factory=list)
    disposition_ids: Optional[List[UUID]] = Field(default_factory=list)
    allowed_fields: Optional[List[str]] = None

class ChannelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    unit_ids: Optional[List[UUID]] = None
    disposition_ids: Optional[List[UUID]] = None
    allowed_fields: Optional[List[str]] = None

class ChannelResponse(ChannelBase):
    id: UUID
    units: List[UnitResponse] = []
    dispositions: List[DispositionResponse] = []
    allowed_fields: Optional[List[str]] = None
    created_at: datetime

    class Config:
        from_attributes = True
