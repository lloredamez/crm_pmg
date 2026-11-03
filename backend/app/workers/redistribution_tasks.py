import asyncio
import logging
import app.models
from app.workers.celery_app import celery_app
from app.core.database import get_worker_session
from app.features.leads.service import LeadService

logger = logging.getLogger(__name__)

async def _async_process_unassigned_leads(limit: int = 50):
    from app.core.business_hours import is_worker_paused_now
    async with get_worker_session() as session:
        is_paused, pause_reason = await is_worker_paused_now(session=session)
        if is_paused:
            logger.info(f"Redistribution worker paused ({pause_reason}).")
            return
        service = LeadService(session)
        assigned_count = await service.process_pending_unassigned_leads(limit=limit)
        if assigned_count > 0:
            logger.info(f"Redistribution worker: Assigned {assigned_count} pending leads.")

def _run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)

@celery_app.task(name="process_unassigned_leads")
def process_unassigned_leads(limit: int = 50):
    logger.info("Executing Celery task to process unassigned leads.")
    _run_async(_async_process_unassigned_leads(limit))
