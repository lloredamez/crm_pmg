import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.core.socket_manager import socket_app
from app.models.user import User
from app.features.auth.router import router as auth_router
from app.features.users.router import router as users_router
from app.features.leads.router import router as leads_router
from app.features.webhooks.router import router as webhooks_router
from app.features.messages.router import router as messages_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_initial_data():
    """Cria tabelas, aplica migrações leves e insere contas demonstrativas para cada perfil (Admin, Supervisor, Atendente)."""
    async with engine.begin() as conn:
        # Garante a criação de novas tabelas
        await conn.run_sync(Base.metadata.create_all)
        # Adiciona colunas que possam faltar em tabelas pré-existentes no volume do Postgres
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255) DEFAULT '';"))

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        existing_users = result.scalars().all()
        
        # Se os usuários antigos não possuem hashed_password, atualizar a senha padrão
        default_password = get_password_hash("senha123")
        
        if not existing_users:
            logger.info("Nenhum usuário encontrado. Criando contas padrão dos 3 perfis (senha: senha123)...")
            demo_users = [
                User(
                    name="Administrador do Sistema",
                    email="admin@crmleads.com",
                    hashed_password=default_password,
                    role="admin",
                    status="online",
                    max_simultaneous_leads=20
                ),
                User(
                    name="Supervisor Comercial",
                    email="supervisor@crmleads.com",
                    hashed_password=default_password,
                    role="supervisor",
                    status="online",
                    max_simultaneous_leads=15
                ),
                User(
                    name="Ana Silva (Atendente)",
                    email="ana.silva@crmleads.com",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10
                ),
                User(
                    name="Bruno Costa (Atendente)",
                    email="bruno.costa@crmleads.com",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=8
                ),
            ]
            session.add_all(demo_users)
            await session.commit()
            logger.info("Usuários padrão (Admin, Supervisor, Atendentes) criados com sucesso!")
        else:
            # Atualiza senhas vazias caso a coluna tenha sido criada agora via ALTER TABLE
            for user in existing_users:
                if not user.hashed_password:
                    user.hashed_password = default_password
            await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicação FastAPI e executando seed de dados...")
    await seed_initial_data()
    yield
    logger.info("Encerrando aplicação FastAPI...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir roteadores de API v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(leads_router, prefix=settings.API_V1_STR)
app.include_router(webhooks_router, prefix=settings.API_V1_STR)
app.include_router(messages_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}

# Acoplar o Socket.IO no caminho especifico /socket.io para nao interceptar as rotas REST
app.mount("/socket.io", socket_app)
