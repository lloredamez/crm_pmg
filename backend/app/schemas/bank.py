from uuid import UUID
from pydantic import BaseModel

class BankResponse(BaseModel):
    id: UUID
    code: str
    name: str
    is_active: bool

    class Config:
        from_attributes = True

