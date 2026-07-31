from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.unit import UnitResponse

class ChannelBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    is_active: bool = Field(default=True)

class ChannelCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    is_active: bool = Field(default=True)
    unit_ids: Optional[List[UUID]] = Field(default_factory=list)

class ChannelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    unit_ids: Optional[List[UUID]] = None

class ChannelResponse(ChannelBase):
    id: UUID
    units: List[UnitResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
