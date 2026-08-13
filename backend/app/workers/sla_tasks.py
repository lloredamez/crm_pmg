import asyncio
import logging
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select, update
import app.models
from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.lead import Lead
from app.models.lead_assignment import LeadAssignment
from app.models.sla_breach import SlaBreach
from app.features.leads.service import LeadService

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

async def _process_expired_leads_in_session(session: AsyncSession):
    now = datetime.now(timezone.utc)
    from app.features.dispositions.service import DispositionService
    disp_service = DispositionService(session)
    target_sla_minutes = await disp_service.get_unassigned_sla_minutes()
    from app.models.bucket_lead import BucketLead
    from app.core.socket_manager import emit_lead_reassigned

    # 1. Checagem de Estouros de SLA de 1º Contato (lead com status 'assigned' que excedeu tempo de atendimento sem interação)
    result = await session.execute(select(Lead).where(Lead.status == "assigned"))
    assigned_leads = list(result.scalars().all())

    expired_first_contact_leads = []
    for lead in assigned_leads:
        if lead.last_interaction_at and lead.assigned_at and lead.last_interaction_at > lead.assigned_at:
            continue
        assigned_time = lead.assigned_at or lead.created_at
        if not assigned_time:
            continue
        elapsed_minutes = (now - assigned_time).total_seconds() / 60.0
        if elapsed_minutes >= target_sla_minutes:
            expired_first_contact_leads.append(lead)

    # 2. Checagem de Estouros de SLA de Tabulação
    disp_result = await session.execute(
        select(Lead).where(
            Lead.disposition_timeout_at.is_not(None),
            Lead.disposition_timeout_at <= now,
            Lead.status.not_in(["converted", "lost"])
        )
    )
    expired_disp_leads = list(disp_result.scalars().all())

    # Processar estouros de 1º contato
    for lead in expired_first_contact_leads:
        logger.warning(f"SLA TIMEOUT EXCEEDED (1st contact) for Lead {lead.id}! Attendant: {lead.current_attendant_id}. Moving to Balde...")
        old_attendant_id = lead.current_attendant_id
        if old_attendant_id:
            await session.execute(
                update(LeadAssignment)
                .where(
                    LeadAssignment.lead_id == lead.id,
                    LeadAssignment.attendant_id == old_attendant_id,
                    LeadAssignment.status == "active"
                )
                .values(status="expired_timeout", unassigned_at=now)
            )

        bucket_lead = BucketLead(
            id=lead.id,
            name=lead.name,
            phone=lead.phone,
            cpf=lead.cpf,
            verified_cpf=lead.verified_cpf,
            proposal_number=lead.proposal_number,
            notes=lead.notes,
            email=lead.email,
            meta_lead_id=lead.meta_lead_id,
            campaign_name=lead.campaign_name,
            product_name=lead.product_name,
            channel_code=lead.channel_code,
            prazo=lead.prazo,
            margem=lead.margem,
            valor_liberado=lead.valor_liberado,
            banco=lead.banco,
            tabela=lead.tabela,
            unit_id=lead.unit_id,
            created_at=lead.created_at
        )
        session.add(bucket_lead)

        sla_breach = SlaBreach(
            lead_id=lead.id,
            attendant_id=old_attendant_id,
            unit_id=lead.unit_id,
            breach_type="first_contact_timeout",
            target_sla_minutes=target_sla_minutes,
            action_taken="sent_to_balde",
            breached_at=now
        )
        session.add(sla_breach)

        await session.delete(lead)
        await session.commit()

        try:
            lead_dict = {
                "id": str(lead.id),
                "name": lead.name,
                "phone": lead.phone,
                "status": lead.status,
                "assigned_at": None,
                "attendant_name": ""
            }
            await emit_lead_reassigned(
                str(old_attendant_id) if old_attendant_id else "",
                "",
                lead_dict
            )
        except Exception as e:
            logger.error(f"Failed to emit socket notification during SLA timeout: {e}")

    # Processar estouros de tabulação
    for lead in expired_disp_leads:
        # Verificar se o lead ainda existe (caso estivesse em ambos os grupos)
        check_exists = await session.execute(select(Lead).where(Lead.id == lead.id))
        if not check_exists.scalar_one_or_none():
            continue

        logger.warning(f"SLA TIMEOUT EXCEEDED (disposition) for Lead {lead.id}! Attendant: {lead.current_attendant_id}. Moving to Balde...")
        old_attendant_id = lead.current_attendant_id
        if old_attendant_id:
            await session.execute(
                update(LeadAssignment)
                .where(
                    LeadAssignment.lead_id == lead.id,
                    LeadAssignment.attendant_id == old_attendant_id,
                    LeadAssignment.status == "active"
                )
                .values(status="disposition_timeout", unassigned_at=now)
            )

        bucket_lead = BucketLead(
            id=lead.id,
            name=lead.name,
            phone=lead.phone,
            cpf=lead.cpf,
            verified_cpf=lead.verified_cpf,
            proposal_number=lead.proposal_number,
            notes=lead.notes,
            email=lead.email,
            meta_lead_id=lead.meta_lead_id,
            campaign_name=lead.campaign_name,
            product_name=lead.product_name,
            channel_code=lead.channel_code,
            prazo=lead.prazo,
            margem=lead.margem,
            valor_liberado=lead.valor_liberado,
            banco=lead.banco,
            tabela=lead.tabela,
            unit_id=lead.unit_id,
            created_at=lead.created_at
        )
        session.add(bucket_lead)

        sla_breach = SlaBreach(
            lead_id=lead.id,
            attendant_id=old_attendant_id,
            unit_id=lead.unit_id,
            breach_type="disposition_timeout",
            target_sla_minutes=None,
            action_taken="sent_to_balde",
            breached_at=now
        )
        session.add(sla_breach)

        await session.delete(lead)
        await session.commit()

        try:
            lead_dict = {
                "id": str(lead.id),
                "name": lead.name,
                "phone": lead.phone,
                "status": lead.status,
                "assigned_at": None,
                "attendant_name": ""
            }
            await emit_lead_reassigned(
                str(old_attendant_id) if old_attendant_id else "",
                "",
                lead_dict
            )
        except Exception:
            pass

async def _async_check_all_expired_leads(session: Optional[AsyncSession] = None):
    if session is not None:
        await _process_expired_leads_in_session(session)
    else:
        async with AsyncSessionLocal() as session_ctx:
            await _process_expired_leads_in_session(session_ctx)

async def _async_check_lead_sla(lead_id_str: str):
    await _async_check_all_expired_leads()

@celery_app.task(name="check_lead_sla_timeout")
def check_lead_sla_timeout(lead_id: str):
    logger.info(f"Executing Celery task SLA timeout check for lead {lead_id}")
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_check_lead_sla(lead_id))
    else:
        loop.run_until_complete(_async_check_lead_sla(lead_id))

async def _async_check_disposition_timeouts():
    await _async_check_all_expired_leads()

@celery_app.task(name="check_disposition_timeouts")
def check_disposition_timeouts():
    logger.info("Executing Celery task to check disposition timeouts.")
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_check_disposition_timeouts())
    else:
        loop.run_until_complete(_async_check_disposition_timeouts())

