import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

import app.models
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.lead import Lead
from app.models.lead_assignment import LeadAssignment
from app.models.sla_breach import SlaBreach
from app.models.user import User

logger = logging.getLogger(__name__)


def _get_inactivity_timeout_minutes() -> float:
    """Lê o tempo limite de inatividade (padrão 60 min / 1 hora), suportando override dinâmico no .env."""
    timeout_mins = float(getattr(settings, "USER_INACTIVITY_TIMEOUT_MINUTES", 60))
    for env_path in [".env", "../.env", "/app/.env", "/home/raul/project/crm_leads/.env", "/home/raul/project/crm_leads/backend/.env"]:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        if k.strip() == "USER_INACTIVITY_TIMEOUT_MINUTES":
                            val_str = v.strip().strip('"').strip("'")
                            timeout_mins = float(val_str)
            except Exception:
                pass
    return timeout_mins


async def check_and_disconnect_inactive_users(session: AsyncSession):
    """
    Desconecta diretamente no banco de dados (UPDATE ... RETURNING) usuários com status != 'offline'
    que ficaram mais de 1 hora (USER_INACTIVITY_TIMEOUT_MINUTES, padrão 60m) sem realizar nenhuma ação,
    sem carregar entidades ORM em memória.
    """
    from app.core.socket_manager import emit_user_status_updated

    now = datetime.now(timezone.utc)
    timeout_minutes = _get_inactivity_timeout_minutes()
    cutoff = now - timedelta(minutes=timeout_minutes)

    # 1. Garante inicialização de last_action_at para usuários online sem timestamp prévio
    await session.execute(
        update(User)
        .where(User.status != "offline", User.last_action_at.is_(None))
        .values(last_action_at=now)
    )

    # 2. Query atômica direto no PostgreSQL que altera para offline e retorna apenas (id, name) dos afetados
    res = await session.execute(
        update(User)
        .where(User.status != "offline", User.last_action_at <= cutoff)
        .values(status="offline")
        .returning(User.id, User.name)
    )
    disconnected_rows = res.all()
    if disconnected_rows:
        await session.commit()

    for user_id, user_name in disconnected_rows:
        logger.info(
            f"User {user_name} ({user_id}) set to OFFLINE due to inactivity (>= {timeout_minutes} min)."
        )
        try:
            await emit_user_status_updated(user_id, "offline", user_name)
        except Exception as e:
            logger.error(f"Erro ao emitir evento de status offline por inatividade para {user_id}: {e}")


async def _process_expired_leads_in_session(session: AsyncSession):
    # 0. Checa inatividade de usuários (independentemente de pausa de calendário)
    try:
        await check_and_disconnect_inactive_users(session)
    except Exception as e:
        logger.error(f"Erro ao verificar inatividade de usuários: {e}")

    from app.core.business_hours import (
        is_worker_paused_now,
        calculate_smart_business_deadline,
    )
    from app.features.dispositions.service import DispositionService
    from app.models.bucket_lead import BucketLead
    from app.core.socket_manager import emit_lead_reassigned

    # Verifica se o worker deve pausar por final de semana, feriado ou horário noturno
    is_paused, pause_reason = await is_worker_paused_now(session=session)
    if is_paused:
        return

    now = datetime.now(timezone.utc)
    disp_service = DispositionService(session)
    target_sla_minutes = await disp_service.get_unassigned_sla_minutes()

    # 1. Backfill único para eventuais leads legados em status 'assigned' sem disposition_timeout_at preenchido
    legacy_res = await session.execute(
        select(Lead)
        .where(
            Lead.status == "assigned",
            Lead.disposition_id.is_(None),
            Lead.disposition_timeout_at.is_(None),
            Lead.is_simulation.is_(False),
        )
        .with_for_update(skip_locked=True)
    )
    legacy_leads = list(legacy_res.scalars().all())
    if legacy_leads:
        for l_lead in legacy_leads:
            if l_lead.last_interaction_at and l_lead.assigned_at and l_lead.last_interaction_at > l_lead.assigned_at:
                continue
            ref_time = l_lead.assigned_at or l_lead.created_at or now
            l_lead.disposition_timeout_at = await calculate_smart_business_deadline(
                session, ref_time, target_sla_minutes
            )
        await session.commit()

    # 2. Busca indexada única (1º contato + tabulação) apenas dos leads já vencidos com FOR UPDATE SKIP LOCKED
    expired_res = await session.execute(
        select(Lead)
        .where(
            Lead.disposition_timeout_at.is_not(None),
            Lead.disposition_timeout_at <= now,
            Lead.status.not_in(["converted", "lost"]),
            Lead.is_simulation.is_(False),
        )
        .with_for_update(skip_locked=True)
    )
    expired_leads = list(expired_res.scalars().all())
    if not expired_leads:
        return

    notifications_to_emit = []

    # 3. Processamento em lote em uma única transação
    for lead in expired_leads:
        is_first_contact = lead.disposition_id is None
        if is_first_contact and lead.last_interaction_at and lead.assigned_at and lead.last_interaction_at > lead.assigned_at:
            lead.disposition_timeout_at = None
            continue

        assignment_status = "expired_timeout" if is_first_contact else "disposition_timeout"
        breach_type = "first_contact_timeout" if is_first_contact else "disposition_timeout"
        breach_sla = target_sla_minutes if is_first_contact else None

        logger.warning(
            f"SLA TIMEOUT EXCEEDED ({breach_type}) for Lead {lead.id}! Attendant: {lead.current_attendant_id}. Moving to Balde..."
        )
        old_attendant_id = lead.current_attendant_id
        if old_attendant_id:
            await session.execute(
                update(LeadAssignment)
                .where(
                    LeadAssignment.lead_id == lead.id,
                    LeadAssignment.attendant_id == old_attendant_id,
                    LeadAssignment.status == "active",
                )
                .values(status=assignment_status, unassigned_at=now)
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
            custom_fields=lead.custom_fields or {},
            unit_id=lead.unit_id,
            created_at=lead.created_at,
        )
        session.add(bucket_lead)

        sla_breach = SlaBreach(
            lead_id=lead.id,
            attendant_id=old_attendant_id,
            unit_id=lead.unit_id,
            breach_type=breach_type,
            target_sla_minutes=breach_sla,
            action_taken="sent_to_balde",
            breached_at=now,
        )
        session.add(sla_breach)

        notifications_to_emit.append(
            (
                str(old_attendant_id) if old_attendant_id else "",
                {
                    "id": str(lead.id),
                    "name": lead.name,
                    "phone": lead.phone,
                    "status": lead.status,
                    "assigned_at": None,
                    "attendant_name": "",
                },
            )
        )

        await session.delete(lead)

    # Commit único do lote inteiro
    await session.commit()

    # Disparo das notificações WebSocket após confirmação da transação
    for old_att_id, lead_dict in notifications_to_emit:
        try:
            await emit_lead_reassigned(old_att_id, "", lead_dict)
        except Exception as e:
            logger.error(f"Failed to emit socket notification during SLA timeout: {e}")


async def _async_check_all_expired_leads(session: Optional[AsyncSession] = None):
    if session is not None:
        await _process_expired_leads_in_session(session)
    else:
        # Reutiliza o pool de conexões AsyncSessionLocal do processo principal (zero overhead de criação de engine)
        async with AsyncSessionLocal() as session_ctx:
            await _process_expired_leads_in_session(session_ctx)

