from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class UnitBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    is_active: bool = Field(default=True)

class UnitCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    is_active: bool = Field(default=True)

class UnitUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None

class UnitResponse(UnitBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
