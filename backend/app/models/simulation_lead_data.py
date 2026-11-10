import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float, BigInteger, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class SimulationLeadData(Base):
    """
    Tabela com os dados cadastrais, pessoais, de endereço, contato e documentos
    do cliente vinculado ao lead de simulação (SimulationLead).
    """
    __tablename__ = "simulation_lead_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    simulation_lead_id = Column(
        UUID(as_uuid=True),
        ForeignKey("simulation_leads.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    # Dados Pessoais e Financeiros
    data_nascimento = Column(String(50), nullable=True)
    sexo = Column(String(50), nullable=True)
    estado_civil = Column(String(50), nullable=True)
    nome_mae = Column(String(255), nullable=True)
    numero_referencial_ipc = Column(BigInteger, nullable=True)
    valor_renda = Column(Float, nullable=True)

    # Endereço
    cep = Column(String(20), nullable=True)
    tipo_logradouro = Column(String(50), nullable=True)
    logradouro = Column(String(255), nullable=True)
    numero = Column(String(50), nullable=True)
    bairro = Column(String(100), nullable=True)
    cidade = Column(String(100), nullable=True)
    uf = Column(String(10), nullable=True)

    # Contato
    ddd_celular = Column(String(10), nullable=True)
    numero_celular = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)

    # Documento
    tipo_documento = Column(String(50), nullable=True)
    numero_documento = Column(String(50), nullable=True)
    orgao_emissor = Column(String(50), nullable=True)
    uf_orgao_emissor = Column(String(10), nullable=True)
    data_emissao = Column(String(50), nullable=True)

    # Dados brutos para contingência
    raw_data = Column(JSON, nullable=True, default=dict)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    # Relacionamento reverso 1:1 com SimulationLead
    lead = relationship("SimulationLead", back_populates="cadastral_data")

