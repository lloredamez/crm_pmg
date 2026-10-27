import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.seed import seed_initial_data
from app.core.socket_manager import socket_app

from app.features.auth.router import router as auth_router
from app.features.users.router import router as users_router
from app.features.leads.router import router as leads_router
from app.features.dispositions.router import router as dispositions_router
from app.features.units.router import router as units_router
from app.features.channels.router import router as channels_router
from app.features.categories.router import router as categories_router
from app.features.webhooks.router import router as webhooks_router
from app.features.messages.router import router as messages_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def _periodic_sla_checker():
    """Worker de checagem periódica de SLA de primeiro contato e tabulação."""
    from app.workers.sla_tasks import _async_check_all_expired_leads
    while True:
        try:
            await asyncio.sleep(15)
            await _async_check_all_expired_leads()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Erro no verificador periódico de SLA: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicação FastAPI e executando bootstrap de dados...")
    await seed_initial_data()
    checker_task = asyncio.create_task(_periodic_sla_checker())
    yield
    checker_task.cancel()
    try:
        await checker_task
    except asyncio.CancelledError:
        pass
    logger.info("Encerrando aplicação FastAPI...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Configuração de CORS com origens autorizadas (lidas de .env / settings)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão dos roteadores da API v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(leads_router, prefix=settings.API_V1_STR)
app.include_router(dispositions_router, prefix=settings.API_V1_STR)
app.include_router(units_router, prefix=settings.API_V1_STR)
app.include_router(channels_router, prefix=settings.API_V1_STR)
app.include_router(categories_router, prefix=settings.API_V1_STR)
app.include_router(webhooks_router, prefix=settings.API_V1_STR)
app.include_router(messages_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}

# Acoplar o Socket.IO no caminho específico /socket.io
app.mount("/socket.io", socket_app)
