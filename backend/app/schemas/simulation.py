from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class SimulationCreate(BaseModel):
    cpf: str = Field(..., description="CPF do cliente para a simulação")

class SimulationUpdate(BaseModel):
    nome: Optional[str] = Field(None, description="Nome do cliente retornado pela simulação")
    cpf: Optional[str] = Field(None, description="CPF do cliente")
    valor_liberado: Optional[float] = Field(None, description="Valor total liberado/aprovado")
    quantidade_parcelas: Optional[int] = Field(None, description="Quantidade de parcelas (prazo)")
    valor_parcela: Optional[float] = Field(None, description="Valor individual de cada parcela")
    banco: Optional[str] = Field(None, description="Nome do banco da operação")
    tabela: Optional[str] = Field(None, description="Nome da tabela/coeficiente")
    status: Optional[str] = Field("completed", description="Status da simulação (completed, rejected, error, etc.)")
    custom_fields: Optional[Dict[str, Any]] = Field(default=None, description="Metadados adicionais da simulação")

class SimulationResponse(BaseModel):
    id: UUID
    name: str
    cpf: Optional[str] = None
    valor_liberado: Optional[float] = None
    quantidade_parcelas: Optional[int] = None
    valor_parcela: Optional[float] = None
    banco: Optional[str] = None
    tabela: Optional[str] = None
    simulation_status: Optional[str] = "pending"
    status: str
    current_attendant_id: Optional[UUID] = None
    attendant_name: Optional[str] = None
    unit_id: Optional[UUID] = None
    unit_name: Optional[str] = None
    webhook_sent_at: Optional[datetime] = None
    created_at: datetime
    custom_fields: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class SimulationPaginationResponse(BaseModel):
    items: List[SimulationResponse]
    total: int
    page: int
    limit: int
    pages: int

