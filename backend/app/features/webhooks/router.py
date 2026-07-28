import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Response, status
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
async def receive_meta_lead(payload: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    logger.info(f"Received Meta Ads Lead Webhook: {payload}")
    
    # Process Lead Data Payload (Direct format or Meta Graph API webhook structure)
    lead_name = payload.get("name") or payload.get("full_name") or "Lead Meta Ads"
    phone = payload.get("phone") or payload.get("phone_number") or "+5511999999999"
    email = payload.get("email")
    campaign_name = payload.get("campaign_name") or payload.get("form_name") or "Meta Ads Campaign"
    meta_lead_id = payload.get("meta_lead_id") or payload.get("id")

    lead_in = LeadCreate(
        name=lead_name,
        phone=phone,
        email=email,
        meta_lead_id=meta_lead_id,
        campaign_name=campaign_name,
        status="new"
    )

    service = LeadService(db)
    lead = await service.create_and_assign_lead(lead_in)

    return {
        "status": "success",
        "lead_id": str(lead.id),
        "assigned_to": str(lead.current_attendant_id) if lead.current_attendant_id else None
    }
