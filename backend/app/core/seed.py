import logging
from sqlalchemy import select, text, or_
from sqlalchemy.orm import selectinload

from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.unit import Unit
from app.models.disposition import Disposition
from app.models.channel import Channel
from app.models.category import Category

logger = logging.getLogger(__name__)

async def apply_database_migrations_and_schema():
    """Garante a integridade do schema e colunas essenciais."""
    async with engine.begin() as conn:
        # Lock transacional no PostgreSQL para evitar condição de corrida (UniqueViolationError em pg_type)
        # caso múltiplos workers/containers iniciem simultaneamente
        await conn.execute(text("SELECT pg_advisory_xact_lock(74839201);"))

        # Garante a criação de novas tabelas
        await conn.run_sync(Base.metadata.create_all)
        
        # Colunas e migrações leves de compatibilidade
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255) DEFAULT '';"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id) ON DELETE SET NULL;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_simulations BOOLEAN DEFAULT FALSE;"))
        
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified_cpf VARCHAR(14);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS proposal_number VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS channel_code VARCHAR(50);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_lead_id VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS prazo INTEGER;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS margem DOUBLE PRECISION;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_liberado DOUBLE PRECISION;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_parcela DOUBLE PRECISION;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS banco VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tabela VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT FALSE;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS simulation_status VARCHAR(50) DEFAULT 'pending';"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS webhook_sent_at TIMESTAMPTZ;"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_is_simulation ON leads(is_simulation);"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS disposition_id UUID REFERENCES dispositions(id) ON DELETE SET NULL;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS dispositioned_at TIMESTAMPTZ;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS disposition_timeout_at TIMESTAMPTZ;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_revealed BOOLEAN DEFAULT FALSE;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMPTZ;"))
        
        await conn.execute(text("ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS disposition_name VARCHAR(255);"))
        await conn.execute(text("ALTER TABLE lead_assignments ADD COLUMN IF NOT EXISTS disposition_notes TEXT;"))
        await conn.execute(text("ALTER TABLE dispositions ALTER COLUMN timeout_minutes TYPE FLOAT USING timeout_minutes::double precision;"))
        
        await conn.execute(text("ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_lead_id_fkey;"))
        await conn.execute(text("ALTER TABLE sla_breaches DROP CONSTRAINT IF EXISTS sla_breaches_lead_id_fkey;"))
        await conn.execute(text("ALTER TABLE lead_tabulations DROP CONSTRAINT IF EXISTS lead_tabulations_lead_id_fkey;"))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_units (
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, unit_id)
            );
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS channel_dispositions (
                channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
                disposition_id UUID REFERENCES dispositions(id) ON DELETE CASCADE,
                PRIMARY KEY (channel_id, disposition_id)
            );
        """))

        await conn.execute(text("ALTER TABLE channels ADD COLUMN IF NOT EXISTS allowed_fields JSON;"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSON;"))
        await conn.execute(text("ALTER TABLE bucket_leads ADD COLUMN IF NOT EXISTS custom_fields JSON;"))

        # Índices de performance para consultas frequentes (listagem de leads, balde, round-robin, SLA e histórico)
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_status ON leads (status);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_current_attendant_id ON leads (current_attendant_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_unit_id ON leads (unit_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_disposition_id ON leads (disposition_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_disposition_timeout_at ON leads (disposition_timeout_at) WHERE disposition_timeout_at IS NOT NULL;"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_created_at_desc ON leads (created_at DESC);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_channel_lower ON leads (lower(trim(channel_code)));"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_leads_attendant_status ON leads (current_attendant_id, status);"))

        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_bucket_leads_unit_id ON bucket_leads (unit_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_bucket_leads_created_at_desc ON bucket_leads (created_at DESC);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_bucket_leads_channel_lower ON bucket_leads (lower(trim(channel_code)));"))

        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_unit_id ON users (unit_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_round_robin ON users (role, is_active, status, unit_id);"))

        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lead_assignments_lead_id ON lead_assignments (lead_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lead_assignments_attendant_id ON lead_assignments (attendant_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lead_assignments_active ON lead_assignments (lead_id, attendant_id, status);"))

        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lead_tabulations_lead_id ON lead_tabulations (lead_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_lead_tabulations_attendant_id ON lead_tabulations (attendant_id);"))

        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sla_breaches_lead_id ON sla_breaches (lead_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sla_breaches_attendant_id ON sla_breaches (attendant_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sla_breaches_unit_id ON sla_breaches (unit_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sla_breaches_breached_at_desc ON sla_breaches (breached_at DESC);"))


async def seed_initial_data():
    """Inicializa tabelas e insere dados padrão demonstrativos se não existirem."""
    await apply_database_migrations_and_schema()

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
                    cpf="111.111.111-11",
                    hashed_password=default_password,
                    role="admin",
                    status="online",
                    max_simultaneous_leads=20,
                    unit_id=None
                ),
                User(
                    name="Marcos Vinícius",
                    email="supervisor@crmleads.com",
                    cpf="333.333.333-33",
                    hashed_password=default_password,
                    role="supervisor",
                    status="online",
                    max_simultaneous_leads=15,
                    unit_id=unit_map.get("U1").id if unit_map.get("U1") else None
                ),
                User(
                    name="Ana Silva",
                    email="ana.silva@crmleads.com",
                    cpf="444.444.444-44",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U1").id if unit_map.get("U1") else None
                ),
                User(
                    name="Bruno Costa",
                    email="bruno.costa@crmleads.com",
                    cpf="555.555.555-55",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U2").id if unit_map.get("U2") else None
                ),
                User(
                    name="Carlos Oliveira",
                    email="carlos.oliveira@crmleads.com",
                    cpf="666.666.666-66",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U3").id if unit_map.get("U3") else None
                ),
                User(
                    name="Daniela Santos",
                    email="daniela.santos@crmleads.com",
                    cpf="777.777.777-77",
                    hashed_password=default_password,
                    role="attendant",
                    status="online",
                    max_simultaneous_leads=10,
                    unit_id=unit_map.get("U1").id if unit_map.get("U1") else None
                ),
                User(
                    name="Eduardo Lima",
                    email="eduardo.lima@crmleads.com",
                    cpf="888.888.888-88",
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
            demo_cpfs = {
                "admin@crmleads.com": "111.111.111-11",
                "supervisor@crmleads.com": "333.333.333-33",
                "ana.silva@crmleads.com": "444.444.444-44",
                "bruno.costa@crmleads.com": "555.555.555-55",
                "carlos.oliveira@crmleads.com": "666.666.666-66",
                "daniela.santos@crmleads.com": "777.777.777-77",
                "eduardo.lima@crmleads.com": "888.888.888-88",
                "gerente.regional@crmleads.com": "222.222.222-22",
            }
            for idx, user in enumerate(existing_users):
                if user.email in clean_names:
                    user.name = clean_names[user.email]
                if user.email in demo_cpfs and not user.cpf:
                    user.cpf = demo_cpfs[user.email]
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
                cpf="222.222.222-22",
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
                Disposition(name="Sem Tabulação (Primeiro Contato)", category="Sem Tabulação", has_timeout=True, timeout_minutes=15),
                Disposition(name="Vendido", category="Venda", has_timeout=False, timeout_minutes=None),
                Disposition(name="Em Contato", category="Negociação", has_timeout=True, timeout_minutes=120),
                Disposition(name="Formalização", category="Negociação", has_timeout=True, timeout_minutes=240),
                Disposition(name="Reapresentação", category="Negociação", has_timeout=True, timeout_minutes=1440),
            ]
            session.add_all(default_dispositions)
            await session.commit()
            logger.info("Tabulações padrão criadas com sucesso!")
        else:
            sem_tab_check = await session.execute(
                select(Disposition).where(
                    or_(
                        Disposition.name.ilike("%Sem Tabulação%"),
                        Disposition.category.ilike("%Sem Tabulação%")
                    )
                )
            )
            if not sem_tab_check.scalars().first():
                sem_tab_disp = Disposition(
                    name="Primeiro Contato",
                    category="Sem Tabulação",
                    has_timeout=True,
                    timeout_minutes=15
                )
                session.add(sem_tab_disp)
                await session.commit()

        # Seed de Canais Padrão
        chan_res = await session.execute(select(Channel))
        existing_channels = chan_res.scalars().all()
        if not existing_channels:
            logger.info("Nenhum canal encontrado. Criando canais padrão...")
            all_units_res = await session.execute(select(Unit))
            all_units = list(all_units_res.scalars().all())
            default_channels = [
                Channel(name="Meta", code="META_ADS", units=all_units),
                Channel(name="Google", code="GOOGLE_ADS", units=all_units),
                Channel(name="WhatsApp", code="WHATSAPP_DIRECT", units=all_units),
                Channel(name="Site", code="WEBSITE", units=all_units),
            ]
            session.add_all(default_channels)
            await session.commit()
            logger.info("Canais padrão criados com sucesso!")

        # Seed de Categorias Padrão
        cat_res = await session.execute(select(Category))
        existing_categories = cat_res.scalars().all()
        if not existing_categories:
            logger.info("Nenhuma categoria encontrada. Criando categorias padrão...")
            default_categories = [
                Category(name="Negociação", description="Leads em fase de contato, proposta ou tratativa comercial", color="amber"),
                Category(name="Venda", description="Leads que fecharam negócio ou converteram em venda", color="emerald"),
                Category(name="Perda", description="Leads desqualificados, sem interesse ou desistentes", color="rose"),
                Category(name="Atendimento", description="Atendimentos gerais e suporte inicial", color="blue"),
            ]
            session.add_all(default_categories)
            await session.commit()
            logger.info("Categorias padrão criadas com sucesso!")
