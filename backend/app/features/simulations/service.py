import re
import math
import logging
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional, List, Tuple
import httpx
from sqlalchemy import select, func, or_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.lead import Lead
from app.models.user import User
from app.schemas.simulation import (
    SimulationCreate,
    SimulationUpdate,
    SimulationResponse
)

logger = logging.getLogger(__name__)

def _format_cpf(clean_cpf: str) -> str:
    if len(clean_cpf) == 11:
        return f"{clean_cpf[:3]}.{clean_cpf[3:6]}.{clean_cpf[6:9]}-{clean_cpf[9:]}"
    return clean_cpf

def _clean_cpf(cpf_str: str) -> str:
    return re.sub(r"\D", "", cpf_str or "")

def _get_simulation_webhook_url() -> Optional[str]:
    """Obtém a URL do webhook das configurações ou lê diretamente do arquivo .env."""
    url = settings.SIMULATION_WEBHOOK_URL or os.getenv("SIMULATION_WEBHOOK_URL")
    if url and url.strip():
        return url.strip()

    # Fallback dinâmico para garantir leitura imediata sem necessidade de restart de container
    for env_path in [".env", "../.env", "/app/.env", "/home/raul/project/crm_leads/.env"]:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("SIMULATION_WEBHOOK_URL="):
                            val = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
            except Exception:
                pass
    return None

class SimulationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _to_response(self, lead: Lead) -> SimulationResponse:
        attendant_name = lead.current_attendant.name if lead.current_attendant else None
        unit_name = lead.unit.name if lead.unit else None
        return SimulationResponse(
            id=lead.id,
            name=lead.name or "Aguardando simulação...",
            cpf=lead.cpf,
            valor_liberado=lead.valor_liberado,
            quantidade_parcelas=lead.prazo,
            valor_parcela=lead.valor_parcela,
            banco=lead.banco,
            tabela=lead.tabela,
            simulation_status=lead.simulation_status or "pending",
            status=lead.status,
            current_attendant_id=lead.current_attendant_id,
            attendant_name=attendant_name,
            unit_id=lead.unit_id,
            unit_name=unit_name,
            webhook_sent_at=lead.webhook_sent_at,
            created_at=lead.created_at,
            custom_fields=lead.custom_fields
        )

    async def create_simulation(self, current_user: User, data: SimulationCreate) -> SimulationResponse:
        clean_cpf = _clean_cpf(data.cpf)
        if not clean_cpf or len(clean_cpf) != 11:
            raise ValueError("CPF inválido. Deve conter 11 dígitos numéricos.")

        formatted_cpf = _format_cpf(clean_cpf)
        now = datetime.now(timezone.utc)

        lead = Lead(
            name="Aguardando simulação...",
            cpf=formatted_cpf,
            verified_cpf=clean_cpf,
            channel_code="SIMULACAO",
            is_simulation=True,
            simulation_status="pending",
            status="assigned",
            current_attendant_id=current_user.id,
            unit_id=current_user.unit_id,
            assigned_at=now,
            created_at=now
        )
        self.db.add(lead)
        await self.db.flush()

        # Disparo do Webhook externo configurado no .env
        webhook_url = _get_simulation_webhook_url()
        if webhook_url:
            webhook_payload = {
                "event": "simulation_created",
                "lead_id": str(lead.id),
                "cpf": clean_cpf,
                "cpf_formatted": formatted_cpf,
                "attendant_id": str(current_user.id),
                "attendant_name": current_user.name,
                "unit_id": str(current_user.unit_id) if current_user.unit_id else None,
                "created_at": now.isoformat()
            }
            logger.info(f"Disparando webhook de simulação para: {webhook_url} | Payload: {webhook_payload}")
            try:
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "CRM-Leads/1.0"
                }
                async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
                    resp = await client.post(webhook_url, json=webhook_payload, headers=headers)
                    logger.info(f"Resposta do webhook de simulação para {lead.id}: HTTP {resp.status_code} - {resp.text[:300]}")
                    if resp.is_success:
                        lead.webhook_sent_at = datetime.now(timezone.utc)
                    else:
                        logger.warning(f"Webhook de simulação retornou status HTTP {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Falha ao enviar webhook de simulação para {webhook_url}: {e}", exc_info=True)
        else:
            logger.warning(f"SIMULATION_WEBHOOK_URL não encontrada no ambiente ou .env. Webhook NÃO disparado para o lead {lead.id}.")

        await self.db.commit()

        # Carregar relacionamentos para serialização
        query = (
            select(Lead)
            .options(selectinload(Lead.current_attendant), selectinload(Lead.unit))
            .where(Lead.id == lead.id)
        )
        lead_res = await self.db.execute(query)
        lead_loaded = lead_res.scalar_one()

        response = self._to_response(lead_loaded)

        # Notificar via WebSocket
        try:
            from app.core.socket_manager import sio
            await sio.emit("simulation:created", {
                "id": str(lead_loaded.id),
                "cpf": lead_loaded.cpf,
                "attendant_id": str(lead_loaded.current_attendant_id),
                "simulation_status": lead_loaded.simulation_status,
                "created_at": lead_loaded.created_at.isoformat()
            })
        except Exception as e:
            logger.warning(f"Falha ao emitir socket simulation:created: {e}")

        return response

    async def list_simulations(
        self,
        current_user: User,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None
    ) -> Tuple[List[SimulationResponse], int]:
        query = (
            select(Lead)
            .options(selectinload(Lead.current_attendant), selectinload(Lead.unit))
            .where(Lead.is_simulation.is_(True))
        )

        # Regras de visualização por perfil
        if current_user.role == "attendant":
            query = query.where(Lead.current_attendant_id == current_user.id)
        elif current_user.role == "supervisor" and current_user.unit_id:
            query = query.where(Lead.unit_id == current_user.unit_id)
        elif current_user.role == "manager":
            managed_ids = current_user.managed_unit_ids or ([current_user.unit_id] if current_user.unit_id else [])
            if managed_ids:
                query = query.where(Lead.unit_id.in_(managed_ids))

        if status and status.lower() != "all":
            query = query.where(Lead.simulation_status == status.lower())

        if search and search.strip():
            s = search.strip()
            clean_s = _clean_cpf(s)
            conditions = [Lead.name.ilike(f"%{s}%")]
            if clean_s:
                conditions.append(Lead.cpf.ilike(f"%{clean_s}%"))
                conditions.append(Lead.verified_cpf.ilike(f"%{clean_s}%"))
            query = query.where(or_(*conditions))

        # Contagem total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await self.db.execute(count_query)
        total = total_res.scalar() or 0

        # Paginação e ordenação
        offset = (page - 1) * limit
        query = query.order_by(desc(Lead.created_at)).offset(offset).limit(limit)

        result = await self.db.execute(query)
        leads = list(result.scalars().all())

        items = [self._to_response(l) for l in leads]
        return items, total

    async def update_simulation_from_api(
        self,
        lead_id: Optional[UUID],
        cpf: Optional[str],
        data: SimulationUpdate
    ) -> SimulationResponse:
        query = (
            select(Lead)
            .options(selectinload(Lead.current_attendant), selectinload(Lead.unit))
            .where(Lead.is_simulation.is_(True))
        )

        if lead_id:
            query = query.where(Lead.id == lead_id)
        elif cpf:
            clean_cpf = _clean_cpf(cpf)
            query = query.where(
                or_(Lead.verified_cpf == clean_cpf, Lead.cpf == _format_cpf(clean_cpf))
            ).order_by(desc(Lead.created_at))
        else:
            raise ValueError("É necessário informar lead_id ou cpf para atualizar a simulação.")

        result = await self.db.execute(query)
        lead = result.scalars().first()

        if not lead:
            raise LookupError("Simulação não encontrada.")

        # Atualização dos campos fornecidos
        if data.nome:
            lead.name = data.nome.strip()
        if data.valor_liberado is not None:
            lead.valor_liberado = float(data.valor_liberado)
        if data.quantidade_parcelas is not None:
            lead.prazo = int(data.quantidade_parcelas)
        if data.valor_parcela is not None:
            lead.valor_parcela = float(data.valor_parcela)
        if data.banco:
            lead.banco = data.banco.strip()
        if data.tabela:
            lead.tabela = data.tabela.strip()
        if data.status:
            lead.simulation_status = data.status.strip()
        else:
            lead.simulation_status = "completed"

        if data.custom_fields:
            current_cf = lead.custom_fields or {}
            lead.custom_fields = {**current_cf, **data.custom_fields}

        await self.db.commit()
        await self.db.refresh(lead)

        response = self._to_response(lead)

        # Emissão WebSocket em tempo real para os consultores
        try:
            from app.core.socket_manager import sio
            await sio.emit("simulation:updated", {
                "id": str(lead.id),
                "name": lead.name,
                "cpf": lead.cpf,
                "valor_liberado": lead.valor_liberado,
                "quantidade_parcelas": lead.prazo,
                "valor_parcela": lead.valor_parcela,
                "banco": lead.banco,
                "tabela": lead.tabela,
                "simulation_status": lead.simulation_status,
                "current_attendant_id": str(lead.current_attendant_id) if lead.current_attendant_id else None
            })
        except Exception as e:
            logger.warning(f"Falha ao emitir socket simulation:updated: {e}")

        return response

