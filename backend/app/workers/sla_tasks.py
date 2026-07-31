import asyncio
import logging
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select, update
from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.lead import Lead
from app.models.lead_assignment import LeadAssignment
from app.features.leads.service import LeadService

logger = logging.getLogger(__name__)

async def _async_check_lead_sla(lead_id_str: str):
    lead_id = UUID(lead_id_str)
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one_or_none()

        if not lead:
            logger.info(f"SLA Check: Lead {lead_id} not found.")
            return

        # If lead has been contacted, moved to in_progress/converted, SLA is fulfilled
        if lead.status not in ["assigned"]:
            logger.info(f"SLA Check: Lead {lead_id} status is {lead.status}, SLA satisfied.")
            return

        if lead.last_interaction_at and lead.assigned_at and lead.last_interaction_at > lead.assigned_at:
            logger.info(f"SLA Check: Lead {lead_id} had interaction at {lead.last_interaction_at}, SLA satisfied.")
            return

        logger.warning(f"SLA TIMEOUT EXCEEDED for Lead {lead_id}! Current attendant: {lead.current_attendant_id}. Reallocating...")
        
        old_attendant_id = lead.current_attendant_id
        now = datetime.now(timezone.utc)

        # Invalidate current assignment
        if old_attendant_id:
            await session.execute(
                update(LeadAssignment)
                .where(
                    LeadAssignment.lead_id == lead_id,
                    LeadAssignment.attendant_id == old_attendant_id,
                    LeadAssignment.status == "active"
                )
                .values(status="expired_timeout", unassigned_at=now)
            )

        # Clear current assignment and re-distribute
        lead.current_attendant_id = None
        service = LeadService(session)
        new_attendant = await service.distribute_lead(lead)
        
        if not new_attendant:
            lead.status = "expired"

        await session.commit()
        await session.refresh(lead)

        # Emit Socket notification
        try:
            from app.core.socket_manager import emit_lead_reassigned
            lead_dict = {
                "id": str(lead.id),
                "name": lead.name,
                "phone": lead.phone,
                "status": lead.status,
                "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                "attendant_name": new_attendant.name if new_attendant else ""
            }
            await emit_lead_reassigned(
                str(old_attendant_id) if old_attendant_id else "",
                str(new_attendant.id) if new_attendant else "",
                lead_dict
            )
        except Exception as e:
            logger.error(f"Failed to emit socket notification during SLA reallocation: {e}")

@celery_app.task(name="check_lead_sla_timeout")
def check_lead_sla_timeout(lead_id: str):
    logger.info(f"Executing Celery task SLA timeout check for lead {lead_id}")
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_check_lead_sla(lead_id))
    else:
        loop.run_until_complete(_async_check_lead_sla(lead_id))

async def _async_check_disposition_timeouts():
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Lead).where(
                Lead.disposition_timeout_at.is_not(None),
                Lead.disposition_timeout_at <= now,
                Lead.status.not_in(["converted", "lost"])
            )
        )
        expired_leads = list(result.scalars().all())
        if not expired_leads:
            return

        logger.warning(f"Disposition Timeout: Found {len(expired_leads)} leads with expired disposition SLA.")
        service = LeadService(session)

        for lead in expired_leads:
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

            lead.current_attendant_id = None
            lead.disposition_timeout_at = None
            new_attendant = await service.distribute_lead(lead)
            if not new_attendant:
                lead.status = "expired"

            await session.commit()
            await session.refresh(lead)

            try:
                from app.core.socket_manager import emit_lead_reassigned
                lead_dict = {
                    "id": str(lead.id),
                    "name": lead.name,
                    "phone": lead.phone,
                    "status": lead.status,
                    "assigned_at": lead.assigned_at.isoformat() if lead.assigned_at else None,
                    "attendant_name": new_attendant.name if new_attendant else ""
                }
                await emit_lead_reassigned(
                    str(old_attendant_id) if old_attendant_id else "",
                    str(new_attendant.id) if new_attendant else "",
                    lead_dict
                )
            except Exception:
                pass

@celery_app.task(name="check_disposition_timeouts")
def check_disposition_timeouts():
    logger.info("Executing Celery task to check disposition timeouts.")
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_check_disposition_timeouts())
    else:
        loop.run_until_complete(_async_check_disposition_timeouts())
