from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    role: str = Field(default="attendant", pattern="^(admin|supervisor|attendant)$")
    status: str = Field(default="offline", pattern="^(online|offline|busy)$")
    max_simultaneous_leads: int = Field(default=10, ge=1, le=100)

class UserCreate(UserBase):
    pass

class UserUpdateStatus(BaseModel):
    status: str = Field(..., pattern="^(online|offline|busy)$")

class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
