from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel

class AttendantPerformanceItem(BaseModel):
    id: UUID
    name: str
    email: Optional[str] = ""
    role: str = "attendant"
    status: str = "offline"
    total_leads: int = 0
    vendas: int = 0
    perdas: int = 0
    outros: int = 0
    valor_total_liberado: float = 0.0

    class Config:
        from_attributes = True

class AttendantPerformanceResponse(BaseModel):
    items: List[AttendantPerformanceItem]
    total_attendants: int
