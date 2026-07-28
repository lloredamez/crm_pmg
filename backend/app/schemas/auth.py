from uuid import UUID
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.schemas.user import UserResponse

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=4)

class UserCreateWithPassword(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=4)
    role: str = Field(default="attendant", pattern="^(admin|supervisor|attendant)$")
    status: str = Field(default="offline", pattern="^(online|offline|busy)$")
    max_simultaneous_leads: int = Field(default=10, ge=1, le=100)
