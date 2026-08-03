import asyncio
import logging
import app.models
from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.features.leads.service import LeadService

logger = logging.getLogger(__name__)

async def _async_process_unassigned_leads(limit: int = 50):
    async with AsyncSessionLocal() as session:
        service = LeadService(session)
        assigned_count = await service.process_pending_unassigned_leads(limit=limit)
        if assigned_count > 0:
            logger.info(f"Redistribution worker: Assigned {assigned_count} pending leads.")

@celery_app.task(name="process_unassigned_leads")
def process_unassigned_leads(limit: int = 50):
    logger.info("Executing Celery task to process unassigned leads.")
    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_async_process_unassigned_leads(limit))
    else:
        loop.run_until_complete(_async_process_unassigned_leads(limit))
