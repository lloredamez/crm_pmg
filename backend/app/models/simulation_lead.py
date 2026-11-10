import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class SimulationLead(Base):
    """
    Tabela exclusiva para leads gerados a partir do módulo de Simulações.
    Estes leads não possuem SLA, tabulações ou timeout de atendimento.
    """
    __tablename__ = "simulation_leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, default="Aguardando simulação...")
    phone = Column(String(50), nullable=True, default="", index=True)
    cpf = Column(String(14), nullable=True, index=True)

    prazo_maximo = Column(Integer, nullable=True)
    valor_bruto_maximo = Column(Float, nullable=True)
    valor_liberado_maximo = Column(Float, nullable=True)
    valor_parcela_maximo = Column(Float, nullable=True)
    proposta_prospect_id = Column(String(255), nullable=True, index=True)
    produto_id = Column(String(255), nullable=True, index=True)
    nome_produto = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSON, nullable=True, default=dict)

    @property
    def PropostaProspectId(self):
        return self.proposta_prospect_id

    @PropostaProspectId.setter
    def PropostaProspectId(self, value):
        self.proposta_prospect_id = value

    @property
    def ProdutoId(self):
        return self.produto_id

    @ProdutoId.setter
    def ProdutoId(self, value):
        self.produto_id = value

    @property
    def NomeProduto(self):
        return self.nome_produto

    @NomeProduto.setter
    def NomeProduto(self, value):
        self.nome_produto = value

    @property
    def margem(self):
        return self.valor_bruto_maximo

    @margem.setter
    def margem(self, value):
        self.valor_bruto_maximo = value

    @property
    def prazo(self):
        return self.prazo_maximo

    @prazo.setter
    def prazo(self, value):
        self.prazo_maximo = value

    @property
    def valor_liberado(self):
        return self.valor_liberado_maximo

    @valor_liberado.setter
    def valor_liberado(self, value):
        self.valor_liberado_maximo = value

    @property
    def valor_parcela(self):
        return self.valor_parcela_maximo

    @valor_parcela.setter
    def valor_parcela(self, value):
        self.valor_parcela_maximo = value

    simulation_status = Column(String(50), nullable=False, default="pending", index=True)
    status = Column(String(50), nullable=False, default="assigned", index=True)

    current_attendant_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="SET NULL"), nullable=True, index=True)

    webhook_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    # Relacionamentos diretos
    unit = relationship("Unit")
    current_attendant = relationship("User", foreign_keys=[current_attendant_id])
    offers = relationship(
        "SimulationOffer",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="desc(SimulationOffer.created_at)"
    )
    cadastral_data = relationship(
        "SimulationLeadData",
        back_populates="lead",
        uselist=False,
        cascade="all, delete-orphan"
    )

    @property
    def quantidade_parcelas(self) -> Optional[int]:
        return self.prazo_maximo

    @quantidade_parcelas.setter
    def quantidade_parcelas(self, val: Optional[int]):
        self.prazo_maximo = val

    @property
    def observacoes(self) -> Optional[str]:
        return self.notes

    @observacoes.setter
    def observacoes(self, val: Optional[str]):
        self.notes = val

