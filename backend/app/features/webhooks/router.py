import hmac
import hashlib
import logging
from typing import Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, Response, Request, Header, Body, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.schemas.lead import LeadCreate
from app.features.leads.service import LeadService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

def _check_webhook_secret(
    request: Request,
    token: Optional[str] = None,
    api_key: Optional[str] = None,
    x_webhook_secret: Optional[str] = None,
    x_api_key: Optional[str] = None,
    authorization: Optional[str] = None
):
    """Valida o segredo de webhook caso WEBHOOK_SECRET esteja configurado no .env."""
    if not settings.WEBHOOK_SECRET:
        return  # Em desenvolvimento ou sem segredo configurado, permite a requisição livremente

    expected = settings.WEBHOOK_SECRET.strip()

    # Extrai o token das várias fontes aceitas
    received = (
        x_webhook_secret
        or x_api_key
        or token
        or api_key
        or request.headers.get("x-webhook-secret")
        or request.headers.get("x-api-key")
        or request.query_params.get("token")
        or request.query_params.get("api_key")
    )

    if not received and authorization and authorization.lower().startswith("bearer "):
        received = authorization[7:].strip()

    if not received or not hmac.compare_digest(received, expected):
        logger.warning("Tentativa de chamada de webhook rejeitada: Token ausente ou inválido.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token de autenticação do webhook inválido ou ausente. Forneça o token no cabeçalho X-Webhook-Secret ou parâmetro ?token="
        )


def _extract_lead_data(payload: Dict[str, Any], default_channel_code: Optional[str] = None) -> LeadCreate:
    """Extrai e normaliza campos de leads vindos de diferentes formatos e ferramentas (Typeform, n8n, Zapier, Meta, etc)."""
    if not isinstance(payload, dict) or not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payload de lead vazio ou inválido.")

    # Suporte a formatos aninhados comuns (ex: {"data": {...}}, {"lead": {...}})
    if "data" in payload and isinstance(payload["data"], dict) and len(payload) == 1:
        payload = payload["data"]
    elif "lead" in payload and isinstance(payload["lead"], dict) and len(payload) == 1:
        payload = payload["lead"]

    # Extração de Nome
    lead_name = (
        payload.get("name")
        or payload.get("full_name")
        or payload.get("nome")
        or payload.get("nome_completo")
        or payload.get("cliente")
        or payload.get("lead_name")
        or "-"
    )

    # Extração de Telefone
    phone = (
        payload.get("phone")
        or payload.get("phone_number")
        or payload.get("telefone")
        or payload.get("celular")
        or payload.get("whatsapp")
        or payload.get("tel")
        or payload.get("contato")
        or ""
    )

    # Extração de Email
    email = (
        payload.get("email")
        or payload.get("e_mail")
        or payload.get("mail")
        or payload.get("correio")
    )

    # Extração de CPF
    cpf = (
        payload.get("cpf")
        or payload.get("documento")
        or payload.get("doc")
        or payload.get("cpf_cnpj")
    )

    # Extração de Campanha
    campaign_name = (
        payload.get("campaign_name")
        or payload.get("campaign")
        or payload.get("campanha")
        or payload.get("utm_campaign")
        or payload.get("form_name")
        or "Webhook Ingestion"
    )

    # Extração de Identificador Externo
    external_id = (
        payload.get("external_id")
        or payload.get("meta_lead_id")
        or payload.get("lead_id")
        or payload.get("id")
    )

    # Extração de Canal
    channel_code = (
        default_channel_code
        or payload.get("channel_code")
        or payload.get("channel")
        or payload.get("canal")
        or payload.get("source")
        or payload.get("origem")
        or payload.get("utm_source")
        or "WEBHOOK"
    )

    # Extração de Notas / Observações
    notes = (
        payload.get("notes")
        or payload.get("observacoes")
        or payload.get("obs")
        or payload.get("mensagem")
        or payload.get("message")
    )

    # Extração de Número de Proposta
    proposal_number = (
        payload.get("proposal_number")
        or payload.get("proposta")
        or payload.get("numero_proposta")
    )

    # Extração de Unidade (opcional)
    raw_unit_id = payload.get("unit_id") or payload.get("loja_id")
    unit_id: Optional[UUID] = None
    if raw_unit_id:
        try:
            unit_id = UUID(str(raw_unit_id))
        except (ValueError, TypeError):
            unit_id = None

    # Extração de Valores e Condições de Crédito
    raw_prazo = payload.get("prazo") or payload.get("meses") or payload.get("parcelas")
    prazo: Optional[int] = None
    if raw_prazo is not None:
        try:
            prazo = int(raw_prazo)
        except (ValueError, TypeError):
            prazo = None

    raw_margem = payload.get("margem") or payload.get("margem_consignavel") or payload.get("margin")
    margem: Optional[float] = None
    if raw_margem is not None:
        try:
            val_str = str(raw_margem).replace(",", ".") if isinstance(raw_margem, str) else raw_margem
            margem = float(val_str)
        except (ValueError, TypeError):
            margem = None

    raw_valor_liberado = (
        payload.get("valor_liberado")
        or payload.get("valor")
        or payload.get("valor_emprestimo")
        or payload.get("amount")
        or payload.get("valor_solicitado")
    )
    valor_liberado: Optional[float] = None
    if raw_valor_liberado is not None:
        try:
            val_str = str(raw_valor_liberado).replace(",", ".") if isinstance(raw_valor_liberado, str) else raw_valor_liberado
            valor_liberado = float(val_str)
        except (ValueError, TypeError):
            valor_liberado = None

    banco = payload.get("banco") or payload.get("bank") or payload.get("instituicao")
    tabela = payload.get("tabela") or payload.get("table")

    return LeadCreate(
        name=str(lead_name).strip() if lead_name else "-",
        phone=str(phone).strip() if phone else "",
        email=str(email).strip() if email else None,
        cpf=str(cpf).strip() if cpf else None,
        proposal_number=str(proposal_number).strip() if proposal_number else None,
        notes=str(notes).strip() if notes else None,
        meta_lead_id=str(external_id).strip() if external_id else None,
        campaign_name=str(campaign_name).strip() if campaign_name else "Webhook Ingestion",
        channel_code=str(channel_code).strip().upper() if channel_code else "WEBHOOK",
        prazo=prazo,
        margem=margem,
        valor_liberado=valor_liberado,
        banco=str(banco).strip() if banco else None,
        tabela=str(tabela).strip() if tabela else None,
        unit_id=unit_id,
        status="new"
    )


# ==============================================================================
# ENDPOINT 1: Webhook Dinâmico por Canal na URL: POST /api/v1/webhooks/{channel_code}
# Ex: POST /api/v1/webhooks/WEBSITE, POST /api/v1/webhooks/WHATSAPP_DIRECT, etc.
# ==============================================================================
@router.post("/{channel_code}", status_code=status.HTTP_200_OK)
async def receive_channel_lead(
    channel_code: str,
    request: Request,
    payload: Dict[str, Any] = Body(
        ...,
        description="Payload de lead para o canal especificado na URL. Suporta campos em português ou inglês.",
        openapi_examples={
            "exemplo_completo": {
                "summary": "Exemplo Completo com Crédito",
                "value": {
                    "nome": "Mariana Souza",
                    "telefone": "+5511977778888",
                    "email": "mariana.souza@exemplo.com",
                    "cpf": "123.456.789-00",
                    "campanha": "Landing Page Outubro",
                    "banco": "Banco Santander",
                    "tabela": "Tabela Flex",
                    "prazo": 84,
                    "margem": 380.50,
                    "valor_liberado": 14200.00,
                    "observacoes": "Cliente solicitou contato no período da tarde"
                }
            },
            "exemplo_simples": {
                "summary": "Exemplo Simples (Nome e Telefone)",
                "value": {
                    "name": "Lucas Pereira",
                    "phone": "+5521999991111",
                    "email": "lucas@exemplo.com"
                }
            }
        }
    ),
    token: Optional[str] = Query(None, description="Token de autenticação do webhook (se WEBHOOK_SECRET estiver configurado)"),
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Recebe leads para um canal específico indicado na rota (ex: WEBSITE, GOOGLE_ADS, WHATSAPP_DIRECT)."""
    _check_webhook_secret(
        request=request,
        token=token,
        x_webhook_secret=x_webhook_secret,
        authorization=authorization
    )

    lead_in = _extract_lead_data(payload, default_channel_code=channel_code)
    service = LeadService(db)
    lead = await service.create_and_assign_lead(lead_in)

    return {
        "status": "success",
        "message": f"Lead atribuído com sucesso para o canal {channel_code.upper()}",
        "lead_id": str(lead.id),
        "channel_code": lead.channel_code,
        "assigned_to": str(lead.current_attendant_id) if lead.current_attendant_id else None
    }


# ==============================================================================
# ENDPOINT 2: Webhook Genérico Universal: POST /api/v1/webhooks
# Aceita o canal dentro do payload (channel_code, canal, origem, etc.)
# ==============================================================================
@router.post("", status_code=status.HTTP_200_OK)
async def receive_generic_lead(
    request: Request,
    payload: Dict[str, Any] = Body(
        ...,
        description="Payload genérico de lead. O canal pode ser informado na chave 'channel_code', 'channel' ou 'canal'.",
        openapi_examples={
            "com_canal": {
                "summary": "Lead com Canal Especificado",
                "value": {
                    "nome": "João Carlos",
                    "telefone": "+5531988884444",
                    "email": "joao.carlos@email.com",
                    "canal": "WEBSITE",
                    "campanha": "Formulário Contato Site",
                    "valor": 10000.00
                }
            }
        }
    ),
    channel: Optional[str] = Query(None, description="Canal opcional informado via Query Parameter"),
    token: Optional[str] = Query(None, description="Token de autenticação do webhook (se WEBHOOK_SECRET estiver configurado)"),
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Recebe leads de qualquer fonte externa com detecção inteligente de canal e campos."""
    _check_webhook_secret(
        request=request,
        token=token,
        x_webhook_secret=x_webhook_secret,
        authorization=authorization
    )

    lead_in = _extract_lead_data(payload, default_channel_code=channel)
    service = LeadService(db)
    lead = await service.create_and_assign_lead(lead_in)

    return {
        "status": "success",
        "message": "Lead recebido e atribuído com sucesso",
        "lead_id": str(lead.id),
        "channel_code": lead.channel_code,
        "assigned_to": str(lead.current_attendant_id) if lead.current_attendant_id else None
    }


# ==============================================================================
# ENDPOINT 3: Webhook Específico Meta Ads: GET/POST /api/v1/webhooks/meta
# ==============================================================================
@router.get("/meta")
async def verify_meta_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    """Handshake de verificação oficial do Meta Webhook."""
    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        logger.info("Meta Webhook verification succeeded.")
        return Response(content=hub_challenge, media_type="text/plain")
    logger.warning("Meta Webhook verification failed. Invalid verify token.")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/meta", status_code=status.HTTP_200_OK)
async def receive_meta_lead(
    request: Request,
    payload: Dict[str, Any] = Body(
        ...,
        description="Payload do lead vindo do Meta Ads Webhook",
        openapi_examples={
            "direct": {
                "summary": "Formato Direto / Teste CRM",
                "value": {
                    "name": "João Silva",
                    "phone": "+5511999998888",
                    "email": "joao.silva@example.com",
                    "cpf": "123.456.789-00",
                    "campaign_name": "Campanha Meta Ads",
                    "channel_code": "META_ADS",
                    "prazo": 84,
                    "margem": 450.00,
                    "valor_liberado": 12500.00,
                    "banco": "Banco Itaú",
                    "tabela": "Tabela Flex"
                }
            }
        }
    ),
    db: AsyncSession = Depends(get_db),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256")
):
    """Endpoint legado/específico para Meta Ads com suporte à validação HMAC SHA-256."""
    if settings.META_APP_SECRET:
        raw_body = await request.body()
        if not x_hub_signature_256 or not x_hub_signature_256.startswith("sha256="):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assinatura de webhook ausente ou em formato inválido."
            )
        signature = x_hub_signature_256.split("sha256=")[-1]
        expected_sig = hmac.new(settings.META_APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Falha na validação criptográfica da assinatura HMAC da Meta."
            )

    lead_in = _extract_lead_data(payload, default_channel_code="META_ADS")
    service = LeadService(db)
    lead = await service.create_and_assign_lead(lead_in)

    return {
        "status": "success",
        "lead_id": str(lead.id),
        "assigned_to": str(lead.current_attendant_id) if lead.current_attendant_id else None
    }
