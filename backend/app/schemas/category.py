from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    color: str = Field(default="blue", max_length=50)
    is_active: bool = Field(default=True)

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    color: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
