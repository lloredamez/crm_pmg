from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "crm_sla_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.sla_tasks",
        "app.workers.redistribution_tasks"
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "process-unassigned-leads-every-2-min": {
            "task": "process_unassigned_leads",
            "schedule": 120.0,
            "args": (50,)
        }
    }
)
