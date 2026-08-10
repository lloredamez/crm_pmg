import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Response, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.schemas.lead import LeadCreate
from app.features.leads.service import LeadService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.get("/meta")
async def verify_meta_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        logger.info("Meta Webhook verification succeeded.")
        return Response(content=hub_challenge, media_type="text/plain")
    logger.warning("Meta Webhook verification failed. Invalid verify token.")
    raise HTTPException(status_code=403, detail="Verification token mismatch")

@router.post("/meta", status_code=status.HTTP_200_OK)
async def receive_meta_lead(
    payload: Dict[str, Any] = Body(
        ...,
        openapi_examples={
            "direct": {
                "summary": "Formato Direto / Padrão",
                "description": "Payload no formato direto com os nomes de campos primários.",
                "value": {
                    "name": "João Silva",
                    "phone": "+5511999998888",
                    "email": "joao.silva@example.com",
                    "cpf": "123.456.789-00",
                    "campaign_name": "Campanha Meta Ads",
                    "meta_lead_id": "1234567890",
                    "channel_code": "meta_ads",
                    "prazo": 84,
                    "margem": 450.00,
                    "valor_liberado": 12500.00,
                    "banco": "Banco Itaú",
                    "tabela": "Tabela Flex"
                }
            },
            "meta_graph": {
                "summary": "Formato Alternativo / Meta Graph API",
                "description": "Payload contendo chaves alternativas aceitas (full_name, phone_number, form_name, id, channel).",
                "value": {
                    "full_name": "Maria Santos",
                    "phone_number": "+5521988887777",
                    "email": "maria.santos@example.com",
                    "form_name": "Formulário de Leads",
                    "id": "9876543210",
                    "channel": "facebook_ads",
                    "prazo": "84",
                    "margem": "450.00",
                    "valor_liberado": "12500.00",
                    "banco": "Bradesco",
                    "tabela": "Tabela Normal"
                }
            }
        }
    ),
    db: AsyncSession = Depends(get_db)
):
    logger.info(f"Received Meta Ads Lead Webhook: {payload}")
    
    # Process Lead Data Payload (Direct format or Meta Graph API webhook structure)
    lead_name = payload.get("name") or payload.get("full_name") or "-"
    phone = payload.get("phone") or payload.get("phone_number") or ""
    email = payload.get("email")
    cpf = payload.get("cpf")
    campaign_name = payload.get("campaign_name") or payload.get("form_name") or "Meta Ads Campaign"
    meta_lead_id = payload.get("meta_lead_id") or payload.get("id")
    channel_code = payload.get("channel_code") or payload.get("channel")

    # Extração dos novos campos
    raw_prazo = payload.get("prazo")
    raw_margem = payload.get("margem")
    raw_valor_liberado = payload.get("valor_liberado") or payload.get("valor") or payload.get("valor_emprestimo")
    banco = payload.get("banco")
    tabela = payload.get("tabela")

    prazo: Optional[int] = None
    if raw_prazo is not None:
        try:
            prazo = int(raw_prazo)
        except (ValueError, TypeError):
            prazo = None

    margem: Optional[float] = None
    if raw_margem is not None:
        try:
            val_str = str(raw_margem).replace(",", ".") if isinstance(raw_margem, str) else raw_margem
            margem = float(val_str)
        except (ValueError, TypeError):
            margem = None

    valor_liberado: Optional[float] = None
    if raw_valor_liberado is not None:
        try:
            val_str = str(raw_valor_liberado).replace(",", ".") if isinstance(raw_valor_liberado, str) else raw_valor_liberado
            valor_liberado = float(val_str)
        except (ValueError, TypeError):
            valor_liberado = None

    lead_in = LeadCreate(
        name=lead_name,
        phone=phone,
        email=email,
        cpf=cpf,
        meta_lead_id=meta_lead_id,
        campaign_name=campaign_name,
        channel_code=channel_code,
        prazo=prazo,
        margem=margem,
        valor_liberado=valor_liberado,
        banco=str(banco).strip() if banco else None,
        tabela=str(tabela).strip() if tabela else None,
        status="new"
    )

    service = LeadService(db)
    lead = await service.create_and_assign_lead(lead_in)

    return {
        "status": "success",
        "lead_id": str(lead.id),
        "assigned_to": str(lead.current_attendant_id) if lead.current_attendant_id else None
    }

