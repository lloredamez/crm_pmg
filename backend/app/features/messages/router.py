from uuid import UUID
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.message import Message
from app.models.lead import Lead
from app.schemas.message import MessageCreate, MessageResponse
from app.features.messages.adapter import MockWhatsAppAdapter

router = APIRouter(prefix="/messages", tags=["Messages"])
whatsapp_adapter = MockWhatsAppAdapter()

@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(msg_in: MessageCreate, db: AsyncSession = Depends(get_db)):
    # Check lead exists
    lead_res = await db.execute(select(Lead).where(Lead.id == msg_in.lead_id))
    lead = lead_res.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    # Send message via adapter if outbound
    external_id = None
    if msg_in.direction == "outbound":
        res = await whatsapp_adapter.send_message(phone=lead.phone, content=msg_in.content)
        external_id = res.get("external_id")

    now = datetime.now(timezone.utc)
    message = Message(
        lead_id=msg_in.lead_id,
        attendant_id=msg_in.attendant_id or lead.current_attendant_id,
        direction=msg_in.direction,
        content=msg_in.content,
        status="sent",
        external_id=external_id,
        created_at=now
    )

    # Update lead interaction timestamp
    lead.last_interaction_at = now
    if lead.status == "assigned":
        lead.status = "in_progress"

    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message

@router.get("/lead/{lead_id}", response_model=List[MessageResponse])
async def list_messages_for_lead(lead_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message).where(Message.lead_id == lead_id).order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())
