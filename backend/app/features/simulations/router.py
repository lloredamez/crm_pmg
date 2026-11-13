import math
import logging
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, Request, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.features.webhooks.router import _check_webhook_secret
from app.schemas.simulation import (
    SimulationCreate,
    SimulationQuoteCreate,
    SimulationLeadDataUpdate,
    SimulationUpdate,
    SimulationResponse,
    SimulationPaginationResponse,
    SimulationOfferHistoryResponse
)
from app.features.simulations.service import SimulationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulations", tags=["Simulações"])

def _ensure_simulation_access(user: User):
    if not (getattr(user, "can_access_simulations", False) or user.role in ["admin", "manager"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: seu usuário não possui permissão para acessar o módulo de Simulações."
        )

@router.post("", response_model=SimulationResponse, status_code=status.HTTP_201_CREATED)
async def create_simulation(
    data: SimulationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cria uma nova simulação a partir do CPF do cliente e dispara o webhook externo."""
    _ensure_simulation_access(current_user)
    service = SimulationService(db)
    try:
        return await service.create_simulation(current_user, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao processar criação de simulação: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao criar simulação.")

@router.get("", response_model=SimulationPaginationResponse)
async def list_simulations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Busca por CPF ou Nome"),
    status: Optional[str] = Query(None, description="Filtro por status da simulação"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lista as simulações cadastradas de acordo com o perfil e permissões do usuário."""
    _ensure_simulation_access(current_user)
    service = SimulationService(db)
    items, total = await service.list_simulations(
        current_user=current_user,
        page=page,
        limit=limit,
        search=search,
        status=status
    )
    pages = math.ceil(total / limit) if total > 0 else 1
    return SimulationPaginationResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )

@router.patch("/callback", response_model=SimulationResponse)
@router.post("/callback", response_model=SimulationResponse)
@router.patch("/callback/", response_model=SimulationResponse)
@router.post("/callback/", response_model=SimulationResponse)
async def update_simulation_callback(
    data: SimulationUpdate,
    request: Request,
    lead_id: Optional[UUID] = Query(None),
    cpf: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    api_key: Optional[str] = Query(None),
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Endpoint alternativo flexível de callback chamado pela API externa via query params ou body (PATCH ou POST)."""
    _check_webhook_secret(
        request=request,
        token=token,
        api_key=api_key,
        x_webhook_secret=x_webhook_secret,
        x_api_key=x_api_key,
        authorization=authorization
    )
    target_cpf = cpf or data.cpf
    target_lead_id = lead_id or data.lead_id
    service = SimulationService(db)
    try:
        return await service.update_simulation_from_api(lead_id=target_lead_id, cpf=target_cpf, data=data)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{id}/quote", response_model=SimulationResponse, status_code=status.HTTP_201_CREATED)
async def request_simulation_quote(
    id: UUID,
    data: SimulationQuoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Dispara uma nova cotação (por parcela ou empréstimo) para o webhook externo com lead_id e produto_id."""
    _ensure_simulation_access(current_user)
    service = SimulationService(db)
    try:
        return await service.request_quotation(lead_id=id, current_user=current_user, data=data)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao processar nova cotação: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao solicitar cotação.")

@router.post("/{id}/offers/{offer_id}/reprocess", response_model=SimulationResponse)
async def reprocess_simulation_offer(
    id: UUID,
    offer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Reprocessa uma cotação existente enviando os dados no webhook externo com o evento new_quotation."""
    _ensure_simulation_access(current_user)
    service = SimulationService(db)
    try:
        return await service.reprocess_quotation(lead_id=id, offer_id=offer_id, current_user=current_user)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao reprocessar cotação: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao reprocessar cotação.")

@router.post("/{id}/offers/{offer_id}/type", response_model=SimulationResponse, summary="Envia a proposta para digitação no webhook")
@router.post("/{id}/offers/{offer_id}/type/", response_model=SimulationResponse, include_in_schema=False)
async def type_simulation_offer(
    id: UUID,
    offer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Envia todos os dados do cliente e da proposta selecionada para o webhook de digitação (válido por até 5 minutos após atualização da oferta)."""
    _ensure_simulation_access(current_user)
    service = SimulationService(db)
    try:
        return await service.type_proposal(lead_id=id, offer_id=offer_id, current_user=current_user)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao digitar proposta da cotação {offer_id} do lead {id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao digitar proposta.")

@router.get("/{id}/offers/{offer_id}/history", response_model=List[SimulationOfferHistoryResponse])
async def get_simulation_offer_history(
    id: UUID,
    offer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retorna o histórico de eventos (criação e reprocessamento) de uma cotação específica."""
    _ensure_simulation_access(current_user)
    service = SimulationService(db)
    try:
        return await service.get_offer_history(lead_id=id, offer_id=offer_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao obter histórico da cotação: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao obter histórico.")

@router.put("/{id}/cadastral-data", response_model=SimulationResponse)
@router.patch("/{id}/cadastral-data", response_model=SimulationResponse)
async def update_simulation_cadastral_data(
    id: UUID,
    data: SimulationLeadDataUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Permite ao consultor autenticado atualizar ou cadastrar os dados cadastrais do cliente."""
    _ensure_simulation_access(current_user)
    service = SimulationService(db)
    try:
        return await service.update_cadastral_data(lead_id=id, current_user=current_user, data=data)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao salvar dados cadastrais da simulação: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno ao salvar dados cadastrais.")

@router.patch("/{id}", response_model=SimulationResponse)
@router.post("/{id}", response_model=SimulationResponse)
@router.patch("/{id}/", response_model=SimulationResponse)
@router.post("/{id}/", response_model=SimulationResponse)
async def update_simulation_by_id(
    id: UUID,
    data: SimulationUpdate,
    request: Request,
    token: Optional[str] = Query(None),
    api_key: Optional[str] = Query(None),
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Endpoint chamado pela API externa para atualizar os dados de uma simulação via lead_id."""
    _check_webhook_secret(
        request=request,
        token=token,
        api_key=api_key,
        x_webhook_secret=x_webhook_secret,
        x_api_key=x_api_key,
        authorization=authorization
    )
    service = SimulationService(db)
    try:
        return await service.update_simulation_from_api(lead_id=id, cpf=None, data=data)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

