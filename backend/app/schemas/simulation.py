from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class SimulationCreate(BaseModel):
    cpf: str = Field(..., description="CPF do cliente para a simulação")
    phone: Optional[str] = Field(None, description="Número de celular com DDD do cliente")
    notes: Optional[str] = Field(None, description="Observações sobre o cliente ou simulação")
    observacoes: Optional[str] = Field(None, description="Alias para notes")

class SimulationQuoteCreate(BaseModel):
    tipo_simulacao: str = Field(..., description="Tipo da simulação: 'valor_parcela' ou 'valor_emprestimo'")
    valor_simulado: float = Field(..., gt=0, description="Valor numérico a ser simulado")
    produto_id: Optional[str] = Field(None, description="ID do produto externo")
    notes: Optional[str] = Field(None, description="Observações adicionais para esta cotação")

class SimulationOfferResponse(BaseModel):
    id: UUID
    simulation_lead_id: UUID
    attendant_id: Optional[UUID] = None
    attendant_name: Optional[str] = None
    valor_bruto: Optional[float] = None
    valor_liberado: Optional[float] = None
    parcela: Optional[int] = None
    quantidade_parcelas: Optional[int] = None
    valor_parcela: Optional[float] = None
    taxa_juros: Optional[float] = None
    status: Optional[str] = "pending"
    custom_fields: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SimulationLeadDataResponse(BaseModel):
    id: UUID
    simulation_lead_id: UUID
    data_nascimento: Optional[str] = None
    sexo: Optional[str] = None
    estado_civil: Optional[str] = None
    nome_mae: Optional[str] = None
    numero_referencial_ipc: Optional[int] = None
    valor_renda: Optional[float] = None
    cep: Optional[str] = None
    tipo_logradouro: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    ddd_celular: Optional[str] = None
    numero_celular: Optional[str] = None
    email: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    orgao_emissor: Optional[str] = None
    uf_orgao_emissor: Optional[str] = None
    data_emissao: Optional[str] = None
    banco_numero: Optional[str] = None
    banco_nome: Optional[str] = None
    agencia: Optional[str] = None
    conta: Optional[str] = None
    conta_digito: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SimulationLeadDataUpdate(BaseModel):
    data_nascimento: Optional[str] = None
    sexo: Optional[str] = None
    estado_civil: Optional[str] = None
    nome_mae: Optional[str] = None
    numero_referencial_ipc: Optional[int] = None
    valor_renda: Optional[float] = None
    cep: Optional[str] = None
    tipo_logradouro: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    ddd_celular: Optional[str] = None
    numero_celular: Optional[str] = None
    email: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    orgao_emissor: Optional[str] = None
    uf_orgao_emissor: Optional[str] = None
    data_emissao: Optional[str] = None
    banco_numero: Optional[str] = None
    banco_nome: Optional[str] = None
    agencia: Optional[str] = None
    conta: Optional[str] = None
    conta_digito: Optional[str] = None

class SimulationUpdate(BaseModel):
    lead_id: Optional[UUID] = Field(None, description="ID do lead de simulação")
    offer_id: Optional[UUID] = Field(None, description="ID da oferta específica a ser atualizada")
    create_new: Optional[bool] = Field(False, description="Se True, cria uma nova cotação no histórico em vez de atualizar a existente")
    attendant_id: Optional[UUID] = Field(None, description="ID do atendente responsável por esta cotação")
    nome: Optional[str] = Field(None, description="Nome do cliente retornado pela simulação")
    cpf: Optional[str] = Field(None, description="CPF do cliente")
    phone: Optional[str] = Field(None, description="Número de celular com DDD do cliente")
    proposta_prospect_id: Optional[str] = Field(None, description="Identificador da proposta prospect externa")
    PropostaProspectId: Optional[str] = Field(None, description="Alias para proposta_prospect_id")
    produto_id: Optional[str] = Field(None, description="Identificador do produto externo")
    ProdutoId: Optional[str] = Field(None, description="Alias para produto_id")
    nome_produto: Optional[str] = Field(None, description="Nome do produto retornado pelo webhook")
    NomeProduto: Optional[str] = Field(None, description="Alias para nome_produto")
    valor_bruto_maximo: Optional[float] = Field(None, description="Valor bruto máximo aprovado para o cliente")
    margem: Optional[float] = Field(None, description="Margem consignável / valor bruto máximo disponível do cliente")
    prazo: Optional[int] = Field(None, description="Prazo máximo de parcelas permitido para o cliente")
    prazo_maximo: Optional[int] = Field(None, description="Prazo máximo de parcelas permitido para o cliente")
    valor_liberado_maximo: Optional[float] = Field(None, description="Valor máximo total liberado aprovado para o cliente")
    valor_parcela_maximo: Optional[float] = Field(None, description="Valor máximo de parcela disponível dentro da margem")
    valor_bruto: Optional[float] = Field(None, description="Valor bruto da cotação")
    valor_liberado: Optional[float] = Field(None, description="Valor líquido da cotação")
    quantidade_parcelas: Optional[int] = Field(None, description="Quantidade de parcelas da cotação")
    parcela: Optional[int] = Field(None, description="Alias para quantidade_parcelas")
    valor_parcela: Optional[float] = Field(None, description="Valor da parcela desta cotação")
    taxa_juros: Optional[float] = Field(None, description="Taxa de juros aplicada")
    status: Optional[str] = Field(None, description="Status da simulação (completed, failed, rejected, error, etc.)")
    simulation_status: Optional[str] = Field(None, description="Status da simulação (alias para status)")
    notes: Optional[str] = Field(None, description="Observações sobre o cliente ou simulação")
    observacoes: Optional[str] = Field(None, description="Alias para notes")
    offers: Optional[List[Dict[str, Any]]] = Field(None, description="Múltiplas opções de ofertas retornadas pelo robô")
    custom_fields: Optional[Dict[str, Any]] = Field(default=None, description="Metadados adicionais da simulação")

    # Dados Cadastrais / Pessoais / Endereço / Contato / Documento (aceita flat ou nested)
    dataNascimento: Optional[str] = Field(None, description="Data de nascimento do cliente")
    data_nascimento: Optional[str] = None
    sexo: Optional[str] = None
    estadoCivil: Optional[str] = None
    estado_civil: Optional[str] = None
    nomeMae: Optional[str] = None
    nome_mae: Optional[str] = None
    numeroReferencialIpc: Optional[int] = None
    numero_referencial_ipc: Optional[int] = None
    valorRenda: Optional[float] = None
    valor_renda: Optional[float] = None
    cep: Optional[str] = None
    tipoLogradouro: Optional[str] = None
    tipo_logradouro: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    dddCelular: Optional[Any] = None
    ddd_celular: Optional[Any] = None
    numeroCelular: Optional[Any] = None
    numero_celular: Optional[Any] = None
    email: Optional[str] = None
    tipoDocumento: Optional[str] = None
    tipo_documento: Optional[str] = None
    numeroDocumento: Optional[str] = None
    numero_documento: Optional[str] = None
    orgaoEmissor: Optional[str] = None
    orgao_emissor: Optional[str] = None
    ufOrgaoEmissor: Optional[str] = None
    uf_orgao_emissor: Optional[str] = None
    dataEmissao: Optional[str] = None
    data_emissao: Optional[str] = None

    # Dados Bancários
    banco: Optional[Any] = None
    banco_numero: Optional[str] = None
    numeroBanco: Optional[str] = None
    numero_banco: Optional[str] = None
    banco_nome: Optional[str] = None
    nomeBanco: Optional[str] = None
    nome_banco: Optional[str] = None
    agencia: Optional[str] = None
    conta: Optional[str] = None
    contaDigito: Optional[str] = None
    conta_digito: Optional[str] = None
    dados_bancarios: Optional[Dict[str, Any]] = None

    # Suporte a objetos aninhados opcionais
    dados_cadastrais: Optional[Dict[str, Any]] = None
    endereco: Optional[Dict[str, Any]] = None
    contato: Optional[Dict[str, Any]] = None
    documento: Optional[Dict[str, Any]] = None

class SimulationResponse(BaseModel):
    id: UUID
    name: str
    cpf: Optional[str] = None
    phone: Optional[str] = None
    proposta_prospect_id: Optional[str] = None
    produto_id: Optional[str] = None
    ProdutoId: Optional[str] = None
    nome_produto: Optional[str] = None
    NomeProduto: Optional[str] = None
    valor_bruto_maximo: Optional[float] = None
    margem: Optional[float] = None
    prazo: Optional[int] = None
    prazo_maximo: Optional[int] = None
    valor_liberado_maximo: Optional[float] = None
    valor_parcela_maximo: Optional[float] = None
    valor_liberado: Optional[float] = None
    quantidade_parcelas: Optional[int] = None
    valor_parcela: Optional[float] = None
    notes: Optional[str] = None
    observacoes: Optional[str] = None
    simulation_status: Optional[str] = "pending"
    status: str
    current_attendant_id: Optional[UUID] = None
    attendant_name: Optional[str] = None
    unit_id: Optional[UUID] = None
    unit_name: Optional[str] = None
    webhook_sent_at: Optional[datetime] = None
    created_at: datetime
    custom_fields: Optional[Dict[str, Any]] = None
    offers: List[SimulationOfferResponse] = []
    total_offers: int = 0
    cadastral_data: Optional[SimulationLeadDataResponse] = None

    class Config:
        from_attributes = True

class SimulationPaginationResponse(BaseModel):
    items: List[SimulationResponse]
    total: int
    page: int
    limit: int
    pages: int

