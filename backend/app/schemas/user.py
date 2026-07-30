from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    role: str = Field(default="attendant", pattern="^(admin|manager|supervisor|attendant)$")
    status: str = Field(default="offline", pattern="^(online|offline|busy)$")
    max_simultaneous_leads: int = Field(default=10, ge=1, le=100)
    unit_id: Optional[UUID] = None
    managed_unit_ids: Optional[List[UUID]] = Field(default_factory=list)

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=4)
    role: Optional[str] = Field(None, pattern="^(admin|manager|supervisor|attendant)$")
    max_simultaneous_leads: Optional[int] = Field(None, ge=1, le=100)
    unit_id: Optional[UUID] = None
    managed_unit_ids: Optional[List[UUID]] = None

class UserUpdateStatus(BaseModel):
    status: str = Field(..., pattern="^(online|offline|busy)$")

class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

