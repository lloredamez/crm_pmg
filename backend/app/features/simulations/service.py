import os
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
from app.models.simulation_lead import SimulationLead
from app.models.simulation_offer import SimulationOffer
from app.models.simulation_lead_data import SimulationLeadData
from app.models.user import User
from app.schemas.simulation import (
    SimulationCreate,
    SimulationQuoteCreate,
    SimulationUpdate,
    SimulationResponse,
    SimulationOfferResponse,
    SimulationLeadDataResponse,
    SimulationLeadDataUpdate
)

logger = logging.getLogger(__name__)

def _format_cpf(clean_cpf: str) -> str:
    if len(clean_cpf) == 11:
        return f"{clean_cpf[:3]}.{clean_cpf[3:6]}.{clean_cpf[6:9]}-{clean_cpf[9:]}"
    return clean_cpf

def _clean_cpf(cpf_str: str) -> str:
    return re.sub(r"\D", "", cpf_str or "")

def _clean_phone(phone_str: Optional[str]) -> str:
    cleaned = re.sub(r"\D", "", phone_str or "")
    if cleaned.startswith("55") and len(cleaned) in (12, 13):
        cleaned = cleaned[2:]
    return cleaned

def _format_phone(clean_phone: str) -> str:
    if len(clean_phone) == 11:
        return f"({clean_phone[:2]}) {clean_phone[2:7]}-{clean_phone[7:]}"
    elif len(clean_phone) == 10:
        return f"({clean_phone[:2]}) {clean_phone[2:6]}-{clean_phone[6:]}"
    return clean_phone

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

    def _to_response(self, lead: SimulationLead) -> SimulationResponse:
        attendant_name = lead.current_attendant.name if lead.current_attendant else None
        unit_name = lead.unit.name if lead.unit else None
        notes_val = lead.notes

        # Mapeamento do histórico de simulações / propostas do lead
        offers_list: List[SimulationOfferResponse] = []
        latest_offer: Optional[SimulationOffer] = None
        if lead.offers:
            # Já ordenadas desc por created_at pelo relationship
            latest_offer = lead.offers[0]
            for o in lead.offers:
                att_name = o.attendant.name if o.attendant else None
                offers_list.append(
                    SimulationOfferResponse(
                        id=o.id,
                        simulation_lead_id=o.simulation_lead_id,
                        attendant_id=o.attendant_id,
                        attendant_name=att_name,
                        valor_bruto=o.valor_bruto,
                        valor_liberado=o.valor_liberado,
                        parcela=o.parcela,
                        quantidade_parcelas=o.parcela,
                        valor_parcela=o.valor_parcela,
                        taxa_juros=o.taxa_juros,
                        status=o.status or "pending",
                        custom_fields=o.custom_fields,
                        created_at=o.created_at,
                    )
                )

        cadastral_resp = None
        if getattr(lead, "cadastral_data", None):
            c = lead.cadastral_data
            cadastral_resp = SimulationLeadDataResponse(
                id=c.id,
                simulation_lead_id=c.simulation_lead_id,
                data_nascimento=c.data_nascimento,
                sexo=c.sexo,
                estado_civil=c.estado_civil,
                nome_mae=c.nome_mae,
                numero_referencial_ipc=c.numero_referencial_ipc,
                valor_renda=c.valor_renda,
                cep=c.cep,
                tipo_logradouro=c.tipo_logradouro,
                logradouro=c.logradouro,
                numero=c.numero,
                bairro=c.bairro,
                cidade=c.cidade,
                uf=c.uf,
                ddd_celular=c.ddd_celular,
                numero_celular=c.numero_celular,
                email=c.email,
                tipo_documento=c.tipo_documento,
                numero_documento=c.numero_documento,
                orgao_emissor=c.orgao_emissor,
                uf_orgao_emissor=c.uf_orgao_emissor,
                data_emissao=c.data_emissao,
                banco_numero=c.banco_numero,
                banco_nome=c.banco_nome,
                agencia=c.agencia,
                conta=c.conta,
                conta_digito=c.conta_digito,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )

        # Campos de status e metadados adicionais
        sim_status = latest_offer.status if latest_offer and latest_offer.status else (lead.simulation_status or "pending")

        # Os campos prazo_maximo, valor_bruto_maximo, valor_liberado_maximo e valor_parcela_maximo
        # contêm os limites máximos do cliente aprovados no lead e permanecem fixos, nunca alterados por cotações maiores.
        return SimulationResponse(
            id=lead.id,
            name=lead.name or "Aguardando simulação...",
            cpf=lead.cpf,
            phone=lead.phone,
            proposta_prospect_id=lead.proposta_prospect_id,
            produto_id=lead.produto_id,
            ProdutoId=lead.produto_id,
            nome_produto=lead.nome_produto,
            NomeProduto=lead.nome_produto,
            valor_bruto_maximo=lead.valor_bruto_maximo,
            margem=lead.valor_bruto_maximo,
            prazo=lead.prazo_maximo,
            prazo_maximo=lead.prazo_maximo,
            valor_liberado_maximo=lead.valor_liberado_maximo,
            valor_parcela_maximo=lead.valor_parcela_maximo,
            valor_liberado=lead.valor_liberado_maximo,
            quantidade_parcelas=lead.prazo_maximo,
            valor_parcela=lead.valor_parcela_maximo,
            notes=notes_val,
            observacoes=notes_val,
            simulation_status=sim_status,
            status=lead.status,
            current_attendant_id=lead.current_attendant_id,
            attendant_name=attendant_name,
            unit_id=lead.unit_id,
            unit_name=unit_name,
            webhook_sent_at=lead.webhook_sent_at,
            created_at=lead.created_at,
            custom_fields=lead.custom_fields,
            offers=offers_list,
            total_offers=len(offers_list),
            cadastral_data=cadastral_resp,
        )

    async def create_simulation(self, current_user: User, data: SimulationCreate) -> SimulationResponse:
        clean_cpf = _clean_cpf(data.cpf)
        if not clean_cpf or len(clean_cpf) != 11:
            raise ValueError("CPF inválido. Deve conter 11 dígitos numéricos.")

        clean_phone = _clean_phone(data.phone) if data.phone else ""
        if clean_phone and len(clean_phone) not in (10, 11):
            raise ValueError("Número de celular inválido. Deve conter DDD e 8 ou 9 dígitos.")
        formatted_phone = _format_phone(clean_phone) if clean_phone else (data.phone.strip() if data.phone else "")

        formatted_cpf = _format_cpf(clean_cpf)
        now = datetime.now(timezone.utc)
        notes_val = (data.notes or data.observacoes or "").strip() or None

        # 1. Regra de compartilhamento: verificar se já existe lead cadastrado com este CPF
        query_existing = (
            select(SimulationLead)
            .options(
                selectinload(SimulationLead.current_attendant),
                selectinload(SimulationLead.unit),
                selectinload(SimulationLead.cadastral_data),
                selectinload(SimulationLead.offers).selectinload(SimulationOffer.attendant)
            )
            .where(or_(SimulationLead.cpf == clean_cpf, SimulationLead.cpf == formatted_cpf))
        )
        res_existing = await self.db.execute(query_existing)
        lead = res_existing.scalars().first()

        if lead:
            # Reaproveita o cadastro do lead existente
            if formatted_phone and not lead.phone:
                lead.phone = formatted_phone
            if notes_val:
                lead.notes = f"{lead.notes}\n[{current_user.name}]: {notes_val}" if lead.notes else notes_val
            lead.updated_at = now
            logger.info(f"CPF {clean_cpf} já existente. Reaproveitando lead {lead.id} para nova cotação do atendente {current_user.name}")
        else:
            # Cria novo lead para este cliente
            lead = SimulationLead(
                name="Aguardando simulação...",
                cpf=formatted_cpf,
                phone=formatted_phone,
                notes=notes_val,
                simulation_status="pending",
                status="assigned",
                current_attendant_id=current_user.id,
                unit_id=current_user.unit_id,
                created_at=now,
                updated_at=now
            )
            self.db.add(lead)
            await self.db.flush()

        # 2. Criação do novo registro individual de simulação/cálculo vinculado ao consultor atual
        new_offer = SimulationOffer(
            simulation_lead_id=lead.id,
            attendant_id=current_user.id,
            status="pending",
            created_at=now,
            updated_at=now
        )
        self.db.add(new_offer)
        await self.db.flush()

        # 3. Disparo do Webhook externo configurado no .env
        webhook_url = _get_simulation_webhook_url()
        if webhook_url:
            webhook_payload = {
                "event": "simulation_created",
                "lead_id": str(lead.id),
                "offer_id": str(new_offer.id),
                "cpf": clean_cpf,
                "cpf_formatted": formatted_cpf,
                "phone": lead.phone or formatted_phone,
                "phone_clean": clean_phone,
                "notes": notes_val,
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
                    logger.info(f"Resposta do webhook de simulação para {lead.id} (offer {new_offer.id}): HTTP {resp.status_code} - {resp.text[:300]}")
                    if resp.is_success:
                        lead.webhook_sent_at = datetime.now(timezone.utc)
                    else:
                        logger.warning(f"Webhook de simulação retornou status HTTP {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Falha ao enviar webhook de simulação para {webhook_url}: {e}", exc_info=True)
        else:
            logger.warning(f"SIMULATION_WEBHOOK_URL não encontrada no ambiente ou .env. Webhook NÃO disparado para o lead {lead.id}.")

        await self.db.commit()

        # Recarregar relacionamentos para serialização
        query = (
            select(SimulationLead)
            .options(
                selectinload(SimulationLead.current_attendant),
                selectinload(SimulationLead.unit),
                selectinload(SimulationLead.cadastral_data),
                selectinload(SimulationLead.offers).selectinload(SimulationOffer.attendant)
            )
            .where(SimulationLead.id == lead.id)
        )
        lead_res = await self.db.execute(query)
        lead_loaded = lead_res.scalar_one()

        response = self._to_response(lead_loaded)

        # Notificar via WebSocket
        try:
            from app.core.socket_manager import sio
            await sio.emit("simulation:created", {
                "id": str(lead_loaded.id),
                "offer_id": str(new_offer.id),
                "cpf": lead_loaded.cpf,
                "phone": lead_loaded.phone,
                "notes": lead_loaded.notes,
                "attendant_id": str(current_user.id),
                "attendant_name": current_user.name,
                "simulation_status": "pending",
                "total_offers": response.total_offers,
                "created_at": lead_loaded.created_at.isoformat()
            })
        except Exception as e:
            logger.warning(f"Falha ao emitir socket simulation:created: {e}")

        return response

    async def update_cadastral_data(
        self,
        lead_id: UUID,
        current_user: User,
        data: SimulationLeadDataUpdate
    ) -> SimulationResponse:
        """Atualiza ou cria os dados cadastrais (pessoal, endereço, contato, documento) de uma simulação."""
        query = (
            select(SimulationLead)
            .options(
                selectinload(SimulationLead.current_attendant),
                selectinload(SimulationLead.unit),
                selectinload(SimulationLead.cadastral_data),
                selectinload(SimulationLead.offers)
            )
            .where(SimulationLead.id == lead_id)
        )
        res = await self.db.execute(query)
        lead = res.scalar_one_or_none()
        if not lead:
            raise LookupError(f"Simulação não encontrada para o ID: {lead_id}")

        now = datetime.now(timezone.utc)
        cad_record = lead.cadastral_data
        if not cad_record:
            cad_record = SimulationLeadData(
                simulation_lead_id=lead.id,
                created_at=now,
                updated_at=now
            )
            self.db.add(cad_record)

        update_dict = data.model_dump(exclude_unset=True)
        for field, val in update_dict.items():
            if hasattr(cad_record, field):
                if isinstance(val, str):
                    val = val.strip()
                setattr(cad_record, field, val)

        cad_record.updated_at = now
        lead.updated_at = now
        await self.db.commit()

        # Recarregar relacionamentos atualizados
        res_reloaded = await self.db.execute(query)
        lead_loaded = res_reloaded.scalar_one()

        response = self._to_response(lead_loaded)

        # Notificar via WebSocket em tempo real
        try:
            from app.core.socket_manager import sio
            await sio.emit("simulation:updated", {
                "id": str(lead_loaded.id),
                "name": lead_loaded.name,
                "cpf": lead_loaded.cpf,
                "phone": lead_loaded.phone,
                "notes": lead_loaded.notes,
                "simulation_status": lead_loaded.simulation_status,
                "total_offers": response.total_offers,
                "offers": [o.model_dump(mode="json") for o in response.offers],
                "cadastral_data": response.cadastral_data.model_dump(mode="json") if response.cadastral_data else None,
                "current_attendant_id": str(lead_loaded.current_attendant_id) if lead_loaded.current_attendant_id else None
            })
        except Exception as e:
            logger.warning(f"Falha ao emitir socket simulation:updated: {e}")

        return response

    async def request_quotation(
        self,
        lead_id: UUID,
        current_user: User,
        data: SimulationQuoteCreate
    ) -> SimulationResponse:
        query = (
            select(SimulationLead)
            .options(
                selectinload(SimulationLead.current_attendant),
                selectinload(SimulationLead.unit),
                selectinload(SimulationLead.cadastral_data),
                selectinload(SimulationLead.offers).selectinload(SimulationOffer.attendant)
            )
            .where(SimulationLead.id == lead_id)
        )
        result = await self.db.execute(query)
        lead = result.scalars().first()
        if not lead:
            raise LookupError("Lead de simulação não encontrado.")

        tipo = data.tipo_simulacao.strip().lower()
        if tipo not in ("valor_emprestimo", "valor_parcela"):
            raise ValueError("tipo_simulacao deve ser 'valor_emprestimo' ou 'valor_parcela'.")

        valor = float(data.valor_simulado)
        if valor <= 0:
            raise ValueError("O valor a ser simulado deve ser maior que zero.")

        now = datetime.now(timezone.utc)
        product_id = lead.produto_id or data.produto_id

        # Atualiza produto_id no lead se fornecido e ainda não preenchido
        if not lead.produto_id and data.produto_id:
            lead.produto_id = data.produto_id.strip()

        # Cria nova oferta pendente vinculada ao atendente
        v_liberado = valor if tipo == "valor_emprestimo" else None
        v_parcela = valor if tipo == "valor_parcela" else None

        new_offer = SimulationOffer(
            simulation_lead_id=lead.id,
            attendant_id=current_user.id,
            valor_liberado=v_liberado,
            valor_parcela=v_parcela,
            status="pending",
            custom_fields={
                "tipo_simulacao": tipo,
                "valor_simulado": valor,
                "notes": data.notes
            },
            created_at=now,
            updated_at=now
        )
        self.db.add(new_offer)
        lead.updated_at = now
        await self.db.flush()

        # Disparo do Webhook externo configurado no .env
        webhook_url = _get_simulation_webhook_url()
        if webhook_url:
            webhook_payload = {
                "event": "new_quotation",
                "lead_id": str(lead.id),
                "offer_id": str(new_offer.id),
                "produto_id": product_id,
                "tipo_simulacao": tipo,
                "valor_simulado": valor,
                "cpf": _clean_cpf(lead.cpf),
                "cpf_formatted": lead.cpf,
                "phone": lead.phone,
                "nome": lead.name,
                "attendant_id": str(current_user.id),
                "attendant_name": current_user.name,
                "unit_id": str(current_user.unit_id) if current_user.unit_id else None,
                "notes": data.notes,
                "created_at": now.isoformat()
            }
            logger.info(f"Disparando webhook de nova cotação para {webhook_url} | Payload: {webhook_payload}")
            try:
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "CRM-Leads/1.0"
                }
                async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
                    resp = await client.post(webhook_url, json=webhook_payload, headers=headers)
                    logger.info(f"Resposta webhook nova cotação {lead.id} (offer {new_offer.id}): HTTP {resp.status_code}")
                    if resp.is_success:
                        lead.webhook_sent_at = datetime.now(timezone.utc)
                    else:
                        logger.warning(f"Webhook de nova cotação retornou status HTTP {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Falha ao enviar webhook de nova cotação para {webhook_url}: {e}", exc_info=True)
        else:
            logger.warning(f"SIMULATION_WEBHOOK_URL não configurada. Webhook de nova cotação NÃO disparado para lead {lead.id}.")

        await self.db.commit()

        # Recarregar relacionamentos
        res_reloaded = await self.db.execute(query)
        lead_loaded = res_reloaded.scalar_one()

        response = self._to_response(lead_loaded)

        # Notificar via WebSocket em tempo real
        try:
            from app.core.socket_manager import sio
            await sio.emit("simulation:updated", {
                "id": str(lead_loaded.id),
                "name": lead_loaded.name,
                "cpf": lead_loaded.cpf,
                "phone": lead_loaded.phone,
                "notes": lead_loaded.notes,
                "simulation_status": lead_loaded.simulation_status,
                "total_offers": response.total_offers,
                "offers": [o.model_dump(mode="json") for o in response.offers],
                "current_attendant_id": str(lead_loaded.current_attendant_id) if lead_loaded.current_attendant_id else None
            })
        except Exception as e:
            logger.warning(f"Falha ao emitir socket simulation:updated: {e}")

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
            select(SimulationLead)
            .options(
                selectinload(SimulationLead.current_attendant),
                selectinload(SimulationLead.unit),
                selectinload(SimulationLead.cadastral_data),
                selectinload(SimulationLead.offers).selectinload(SimulationOffer.attendant)
            )
        )

        # Regras de visualização por perfil:
        # Quando há busca (ex.: consulta de CPF), o atendente pode localizar o lead para ver os dados já existentes!
        has_search = bool(search and search.strip())

        if current_user.role == "attendant":
            if not has_search:
                # Na listagem padrão sem busca, exibe os leads atribuídos, cotados por ele ou da mesma unidade
                unit_cond = [SimulationLead.unit_id == current_user.unit_id] if current_user.unit_id else []
                query = query.where(
                    or_(
                        SimulationLead.current_attendant_id == current_user.id,
                        SimulationLead.offers.any(SimulationOffer.attendant_id == current_user.id),
                        *unit_cond
                    )
                )
        elif current_user.role == "supervisor" and current_user.unit_id:
            query = query.where(SimulationLead.unit_id == current_user.unit_id)
        elif current_user.role == "manager":
            managed_ids = current_user.managed_unit_ids or ([current_user.unit_id] if current_user.unit_id else [])
            if managed_ids:
                query = query.where(SimulationLead.unit_id.in_(managed_ids))

        if status and status.lower() != "all":
            # Filtra por status do lead ou de qualquer uma de suas ofertas
            query = query.where(
                or_(
                    SimulationLead.simulation_status == status.lower(),
                    SimulationLead.offers.any(SimulationOffer.status == status.lower())
                )
            )

        if has_search:
            s = search.strip()
            clean_s = _clean_cpf(s)
            conditions = [SimulationLead.name.ilike(f"%{s}%"), SimulationLead.notes.ilike(f"%{s}%")]
            if clean_s:
                conditions.append(SimulationLead.cpf.ilike(f"%{clean_s}%"))
                conditions.append(SimulationLead.cpf.ilike(f"%{_format_cpf(clean_s)}%"))
                conditions.append(SimulationLead.phone.ilike(f"%{clean_s}%"))
            else:
                conditions.append(SimulationLead.phone.ilike(f"%{s}%"))
            query = query.where(or_(*conditions))

        # Contagem total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await self.db.execute(count_query)
        total = total_res.scalar() or 0

        # Paginação e ordenação
        offset = (page - 1) * limit
        query = query.order_by(desc(SimulationLead.created_at)).offset(offset).limit(limit)

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
            select(SimulationLead)
            .options(
                selectinload(SimulationLead.current_attendant),
                selectinload(SimulationLead.unit),
                selectinload(SimulationLead.cadastral_data),
                selectinload(SimulationLead.offers).selectinload(SimulationOffer.attendant)
            )
        )

        if lead_id:
            query = query.where(SimulationLead.id == lead_id)
        elif cpf:
            clean_cpf = _clean_cpf(cpf)
            query = query.where(
                or_(SimulationLead.cpf == clean_cpf, SimulationLead.cpf == _format_cpf(clean_cpf))
            ).order_by(desc(SimulationLead.created_at))
        else:
            raise ValueError("É necessário informar lead_id ou cpf para atualizar a simulação.")

        result = await self.db.execute(query)
        lead = result.scalars().first()

        if not lead:
            raise LookupError("Simulação não encontrada.")

        now = datetime.now(timezone.utc)

        # Atualização dos dados do cliente no Lead
        if data.nome:
            lead.name = data.nome.strip()
        if data.phone:
            clean_p = _clean_phone(data.phone)
            lead.phone = _format_phone(clean_p) if clean_p else data.phone.strip()

        prop_id = data.proposta_prospect_id if data.proposta_prospect_id is not None else data.PropostaProspectId
        if prop_id is not None:
            lead.proposta_prospect_id = str(prop_id).strip()

        prod_id = data.produto_id if data.produto_id is not None else data.ProdutoId
        if prod_id is not None:
            lead.produto_id = str(prod_id).strip()

        prod_name = data.nome_produto if data.nome_produto is not None else data.NomeProduto
        if prod_name is not None:
            lead.nome_produto = str(prod_name).strip()

        # Limites máximos disponíveis para o cliente (teto de valor bruto, prazo, valor liberado e parcela)
        # Preenchidos na chamada do webhook e permanecem fixos
        if data.valor_bruto_maximo is not None:
            lead.valor_bruto_maximo = float(data.valor_bruto_maximo)
        elif data.margem is not None:
            lead.valor_bruto_maximo = float(data.margem)

        if data.valor_liberado_maximo is not None:
            lead.valor_liberado_maximo = float(data.valor_liberado_maximo)
        elif lead.valor_liberado_maximo is None and data.valor_liberado is not None and not data.create_new:
            lead.valor_liberado_maximo = float(data.valor_liberado)

        if data.prazo_maximo is not None:
            lead.prazo_maximo = int(data.prazo_maximo)
        elif data.prazo is not None:
            lead.prazo_maximo = int(data.prazo)
        elif lead.prazo_maximo is None and (data.quantidade_parcelas is not None or data.parcela is not None) and not data.create_new:
            lead.prazo_maximo = int(data.quantidade_parcelas if data.quantidade_parcelas is not None else data.parcela)

        if data.valor_parcela_maximo is not None:
            lead.valor_parcela_maximo = float(data.valor_parcela_maximo)
        elif lead.valor_parcela_maximo is None and data.valor_parcela is not None and not data.create_new:
            lead.valor_parcela_maximo = float(data.valor_parcela)

        # Processamento e atualização dos Dados Cadastrais do Cliente (SimulationLeadData)
        cad_payload = data.dados_cadastrais or {}
        end_payload = data.endereco or {}
        cont_payload = data.contato or {}
        doc_payload = data.documento or {}
        bank_payload = data.dados_bancarios or {}
        if isinstance(data.banco, dict):
            bank_payload = {**bank_payload, **data.banco}

        def _get_cad(*keys, default=None):
            for k in keys:
                val = getattr(data, k, None)
                if val is not None and val != "":
                    return val
                for d in (cad_payload, end_payload, cont_payload, doc_payload, bank_payload):
                    if isinstance(d, dict) and k in d and d[k] is not None and d[k] != "":
                        return d[k]
            return default

        dt_nasc = _get_cad("dataNascimento", "data_nascimento")
        sexo_val = _get_cad("sexo")
        est_civil = _get_cad("estadoCivil", "estado_civil")
        mae_val = _get_cad("nomeMae", "nome_mae")
        ipc_val = _get_cad("numeroReferencialIpc", "numero_referencial_ipc")
        renda_val = _get_cad("valorRenda", "valor_renda")
        cep_val = _get_cad("cep")
        tipo_logr = _get_cad("tipoLogradouro", "tipo_logradouro")
        logr_val = _get_cad("logradouro")
        num_end = _get_cad("numero", "numeroEndereco", "numero_endereco")
        bairro_val = _get_cad("bairro")
        cidade_val = _get_cad("cidade")
        uf_val = _get_cad("uf")
        ddd_cel = _get_cad("dddCelular", "ddd_celular", "ddd")
        num_cel = _get_cad("numeroCelular", "numero_celular", "celular")
        email_val = _get_cad("email")
        tipo_doc = _get_cad("tipoDocumento", "tipo_documento")
        num_doc = _get_cad("numeroDocumento", "numero_documento")
        if not num_doc and isinstance(doc_payload, dict) and "numero" in doc_payload:
            num_doc = doc_payload["numero"]
        org_emiss = _get_cad("orgaoEmissor", "orgao_emissor")
        uf_emiss = _get_cad("ufOrgaoEmissor", "uf_orgao_emissor")
        dt_emiss = _get_cad("dataEmissao", "data_emissao")

        banco_num = _get_cad("banco_numero", "numeroBanco", "numero_banco", "bancoNumero")
        if not banco_num and isinstance(data.banco, str) and data.banco.isdigit():
            banco_num = data.banco
        banco_nm = _get_cad("banco_nome", "nomeBanco", "nome_banco", "bancoNome")
        if not banco_nm and isinstance(data.banco, str) and not data.banco.isdigit():
            banco_nm = data.banco
        agencia_val = _get_cad("agencia")
        conta_val = _get_cad("conta")
        conta_dig = _get_cad("contaDigito", "conta_digito")

        has_cadastral = any(v is not None for v in [
            dt_nasc, sexo_val, est_civil, mae_val, ipc_val, renda_val,
            cep_val, tipo_logr, logr_val, num_end, bairro_val, cidade_val, uf_val,
            ddd_cel, num_cel, email_val, tipo_doc, num_doc, org_emiss, uf_emiss, dt_emiss,
            banco_num, banco_nm, agencia_val, conta_val, conta_dig
        ])

        if has_cadastral:
            cad_record = lead.cadastral_data
            if not cad_record:
                cad_record = SimulationLeadData(
                    simulation_lead_id=lead.id,
                    created_at=now,
                    updated_at=now
                )
                self.db.add(cad_record)

            if dt_nasc is not None:
                cad_record.data_nascimento = str(dt_nasc).strip()
            if sexo_val is not None:
                cad_record.sexo = str(sexo_val).strip()
            if est_civil is not None:
                cad_record.estado_civil = str(est_civil).strip()
            if mae_val is not None:
                cad_record.nome_mae = str(mae_val).strip()
            if ipc_val is not None:
                try:
                    cad_record.numero_referencial_ipc = int(ipc_val)
                except (ValueError, TypeError):
                    pass
            if renda_val is not None:
                try:
                    cad_record.valor_renda = float(renda_val)
                except (ValueError, TypeError):
                    pass

            if cep_val is not None:
                cad_record.cep = str(cep_val).strip()
            if tipo_logr is not None:
                cad_record.tipo_logradouro = str(tipo_logr).strip()
            if logr_val is not None:
                cad_record.logradouro = str(logr_val).strip()
            if num_end is not None:
                cad_record.numero = str(num_end).strip()
            if bairro_val is not None:
                cad_record.bairro = str(bairro_val).strip()
            if cidade_val is not None:
                cad_record.cidade = str(cidade_val).strip()
            if uf_val is not None:
                cad_record.uf = str(uf_val).strip()

            if ddd_cel is not None:
                cad_record.ddd_celular = str(ddd_cel).strip()
            if num_cel is not None:
                cad_record.numero_celular = str(num_cel).strip()
            if email_val is not None:
                cad_record.email = str(email_val).strip()

            if not lead.phone and ddd_cel and num_cel:
                clean_full_phone = f"{ddd_cel}{num_cel}"
                lead.phone = _format_phone(clean_full_phone)

            if tipo_doc is not None:
                cad_record.tipo_documento = str(tipo_doc).strip()
            if num_doc is not None:
                cad_record.numero_documento = str(num_doc).strip()
            if org_emiss is not None:
                cad_record.orgao_emissor = str(org_emiss).strip()
            if uf_emiss is not None:
                cad_record.uf_orgao_emissor = str(uf_emiss).strip()
            if dt_emiss is not None:
                cad_record.data_emissao = str(dt_emiss).strip()

            if banco_num is not None:
                cad_record.banco_numero = str(banco_num).strip()
            if banco_nm is not None:
                cad_record.banco_nome = str(banco_nm).strip()
            if agencia_val is not None:
                cad_record.agencia = str(agencia_val).strip()
            if conta_val is not None:
                cad_record.conta = str(conta_val).strip()
            if conta_dig is not None:
                cad_record.conta_digito = str(conta_dig).strip()

            cad_record.updated_at = now

        notes_val = data.notes if data.notes is not None else data.observacoes
        if notes_val is not None:
            lead.notes = notes_val.strip() if notes_val else None

        status_val = data.simulation_status or data.status
        normalized_status = status_val.strip().lower() if status_val else "completed"

        # Atualização ou inserção das ofertas no histórico
        if data.offers and isinstance(data.offers, list):
            # Robô enviou múltiplas opções de parcelamento
            for item in data.offers:
                off = SimulationOffer(
                    simulation_lead_id=lead.id,
                    attendant_id=lead.current_attendant_id,
                    valor_bruto=float(item.get("valor_bruto")) if item.get("valor_bruto") is not None else None,
                    valor_liberado=float(item.get("valor_liberado")) if item.get("valor_liberado") is not None else None,
                    parcela=int(item.get("parcela") or item.get("quantidade_parcelas")) if (item.get("parcela") or item.get("quantidade_parcelas")) is not None else None,
                    valor_parcela=float(item.get("valor_parcela")) if item.get("valor_parcela") is not None else None,
                    taxa_juros=float(item.get("taxa_juros")) if item.get("taxa_juros") is not None else None,
                    status=str(item.get("status") or normalized_status).strip().lower(),
                    custom_fields=item.get("custom_fields") or {},
                    created_at=now,
                    updated_at=now
                )
                self.db.add(off)
            lead.simulation_status = normalized_status
        else:
            # Atualização de oferta única ou inserção de nova cotação
            target_offer: Optional[SimulationOffer] = None
            offer_attendant_id = data.attendant_id or lead.current_attendant_id

            if not data.create_new:
                if data.offer_id and lead.offers:
                    for o in lead.offers:
                        if o.id == data.offer_id:
                            target_offer = o
                            break

                if not target_offer and lead.offers:
                    # Procura a oferta pendente mais recente
                    for o in lead.offers:
                        if o.status == "pending":
                            target_offer = o
                            break
                    # Se não houver pendente, usa a mais recente
                    if not target_offer:
                        target_offer = lead.offers[0]

            if not target_offer:
                target_offer = SimulationOffer(
                    simulation_lead_id=lead.id,
                    attendant_id=offer_attendant_id,
                    created_at=now,
                    updated_at=now
                )
                self.db.add(target_offer)
            elif data.attendant_id:
                target_offer.attendant_id = data.attendant_id

            # Atualizar os campos da oferta
            if data.valor_bruto is not None:
                target_offer.valor_bruto = float(data.valor_bruto)
            if data.valor_liberado is not None:
                target_offer.valor_liberado = float(data.valor_liberado)
            qtd_p = data.quantidade_parcelas if data.quantidade_parcelas is not None else data.parcela
            if qtd_p is not None:
                target_offer.parcela = int(qtd_p)
            if data.valor_parcela is not None:
                target_offer.valor_parcela = float(data.valor_parcela)
            if data.taxa_juros is not None:
                target_offer.taxa_juros = float(data.taxa_juros)
            target_offer.status = normalized_status
            target_offer.updated_at = now

            if data.custom_fields:
                current_cf = target_offer.custom_fields or {}
                target_offer.custom_fields = {**current_cf, **data.custom_fields}

            # Os limites máximos do lead (prazo, margem, valor_liberado, valor_parcela) permanecem fixos
            # e nunca são sobrescritos quando ofertas ou valores maiores chegam.
            lead.simulation_status = normalized_status

        lead.updated_at = now
        await self.db.commit()

        # Recarregar
        lead_res = await self.db.execute(query.where(SimulationLead.id == lead.id))
        lead_reloaded = lead_res.scalar_one()

        response = self._to_response(lead_reloaded)

        # Emissão WebSocket em tempo real para os consultores
        try:
            from app.core.socket_manager import sio
            await sio.emit("simulation:updated", {
                "id": str(lead_reloaded.id),
                "name": lead_reloaded.name,
                "cpf": lead_reloaded.cpf,
                "phone": lead_reloaded.phone,
                "notes": lead_reloaded.notes,
                "simulation_status": lead_reloaded.simulation_status,
                "total_offers": response.total_offers,
                "offers": [o.model_dump(mode="json") for o in response.offers],
                "current_attendant_id": str(lead_reloaded.current_attendant_id) if lead_reloaded.current_attendant_id else None
            })
        except Exception as e:
            logger.warning(f"Falha ao emitir socket simulation:updated: {e}")

        return response


