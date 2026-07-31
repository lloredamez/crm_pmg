import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.core.socket_manager import socket_app
from app.models.user import User
from app.models.unit import Unit
from app.models.disposition import Disposition
from app.features.auth.router import router as auth_router
from app.features.users.router import router as users_router
from app.features.leads.router import router as leads_router
from app.features.dispositions.router import router as dispositions_router
from app.features.webhooks.router import router as webhooks_router
from app.features.messages.router import router as messages_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_initial_data():
    """Cria tabelas, aplica migrações leves e insere unidades e contas demonstrativas para cada esteira."""
    async with engine.begin() as conn:
        # Garante a criação de novas tabelas (ex: units, dispositions)
        await conn.run_sync(Base.metadata.create_all)
        # Adiciona colunas que possam faltar em tabelas pré-existentes no volume do Postgres
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255) DEFAULT '';"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE SET NULL;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified_cpf VARCHAR(14);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS proposal_number VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS disposition_id UUID REFERENCES dispositions(id) ON DELETE SET NULL;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS dispositioned_at TIMESTAMPTZ;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS disposition_timeout_at TIMESTAMPTZ;"))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_units (
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, unit_id)
            );
        """))

    async with AsyncSessionLocal() as session:
        # Seed das Unidades
        units_res = await session.execute(select(Unit))
        existing_units = units_res.scalars().all()
        unit_map = {}

        if not existing_units:
            logger.info("Nenhuma unidade encontrada. Criando 3 Unidades Padrão...")
            units = [
                Unit(name="Unidade 1 - São Paulo", code="U1"),
                Unit(name="Unidade 2 - Rio de Janeiro", code="U2"),
                Unit(name="Unidade 3 - Belo Horizonte", code="U3"),
            ]
            session.add_all(units)
            await session.commit()
            for u in units:
                await session.refresh(u)
                unit_map[u.code] = u
        else:
            for u in existing_units:
                unit_map[u.code] = u

        # Seed dos Usuários
        result = await session.execute(select(User))
        existing_users = result.scalars().all()
        default_password = get_password_hash("senha123")
        
        if not existing_users:
            logger.info("Nenhum usuário encontrado. Criando contas por unidade (senha: senha123)...")
            demo_users = [
                User(
                    name="Carlos Admin",
                    email="admin@crmleads.com",
                    hashed_password=default_password,
                    role="admin",
                    status="online",
                    max_simultaneous_leads=20,
                    unit_id=None
                ),
                User(
                    name="Marcos Vinícius",
                    email="supervisor@crmleads.com",
                    hashed_password=default_password,
                    role="supervisor",
                    status="online",
                    max_simultaneous_leads=15,
                    unit_id=unit_map.get("U1").id if unit_map.get("U1") else None
                ),
                User(
                    name="Ana Silva",
                    email="ana.silva@crmleads.com",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U1").id if unit_map.get("U1") else None
                ),
                User(
                    name="Bruno Costa",
                    email="bruno.costa@crmleads.com",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U2").id if unit_map.get("U2") else None
                ),
                User(
                    name="Carlos Oliveira",
                    email="carlos.oliveira@crmleads.com",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U3").id if unit_map.get("U3") else None
                ),
                User(
                    name="Daniela Santos",
                    email="daniela.santos@crmleads.com",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U1").id if unit_map.get("U1") else None
                ),
                User(
                    name="Eduardo Lima",
                    email="eduardo.lima@crmleads.com",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U2").id if unit_map.get("U2") else None
                ),
            ]
            session.add_all(demo_users)
            await session.commit()
            logger.info("Usuários de demonstração por unidade criados com sucesso!")
        else:
            u_list = list(unit_map.values())
            clean_names = {
                "admin@crmleads.com": "Carlos Admin",
                "supervisor@crmleads.com": "Marcos Vinícius",
                "ana.silva@crmleads.com": "Ana Silva",
                "bruno.costa@crmleads.com": "Bruno Costa",
                "carlos.oliveira@crmleads.com": "Carlos Oliveira",
                "daniela.santos@crmleads.com": "Daniela Santos",
                "eduardo.lima@crmleads.com": "Eduardo Lima",
                "gerente.regional@crmleads.com": "Roberto Mendes",
            }
            for idx, user in enumerate(existing_users):
                if user.email in clean_names:
                    user.name = clean_names[user.email]
                if not user.hashed_password:
                    user.hashed_password = default_password
                if user.role not in ["admin", "manager"] and not user.unit_id and u_list:
                    user.unit_id = u_list[idx % len(u_list)].id
            await session.commit()

        # Garante a existência da conta de Gerente de demonstração com múltiplas unidades
        manager_check = await session.execute(
            select(User).options(selectinload(User.managed_units)).where(User.email == "gerente.regional@crmleads.com")
        )
        if not manager_check.scalar_one_or_none():
            u1 = unit_map.get("U1")
            u2 = unit_map.get("U2")
            managed = [u for u in [u1, u2] if u is not None]
            manager_user = User(
                name="Roberto Mendes",
                email="gerente.regional@crmleads.com",
                hashed_password=default_password,
                role="manager",
                status="online",
                max_simultaneous_leads=20,
                unit_id=None,
                managed_units=managed
            )
            session.add(manager_user)
            await session.commit()

        # Seed de Tabulações Padrão
        disp_res = await session.execute(select(Disposition))
        existing_dispositions = disp_res.scalars().all()
        if not existing_dispositions:
            logger.info("Nenhuma tabulação encontrada. Criando tabulações padrão...")
            default_dispositions = [
                Disposition(name="Vendido", category="Venda", has_timeout=False, timeout_minutes=None),
                Disposition(name="Em Contato", category="Negociação", has_timeout=True, timeout_minutes=120),
                Disposition(name="Formalização", category="Negociação", has_timeout=True, timeout_minutes=240),
                Disposition(name="Reapresentação", category="Negociação", has_timeout=True, timeout_minutes=1440),
            ]
            session.add_all(default_dispositions)
            await session.commit()
            logger.info("Tabulações padrão criadas com sucesso!")

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
app.include_router(dispositions_router, prefix=settings.API_V1_STR)
app.include_router(webhooks_router, prefix=settings.API_V1_STR)
app.include_router(messages_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "version": settings.VERSION}

# Acoplar o Socket.IO no caminho especifico /socket.io para nao interceptar as rotas REST
app.mount("/socket.io", socket_app)
