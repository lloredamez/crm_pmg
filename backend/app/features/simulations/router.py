import math
import logging
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Request, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.features.webhooks.router import _check_webhook_secret
from app.schemas.simulation import (
    SimulationCreate,
    SimulationUpdate,
    SimulationResponse,
    SimulationPaginationResponse
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

@router.patch("/{id}", response_model=SimulationResponse)
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

@router.patch("/callback", response_model=SimulationResponse)
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
    """Endpoint alternativo flexível de callback chamado pela API externa via query params ou body."""
    _check_webhook_secret(
        request=request,
        token=token,
        api_key=api_key,
        x_webhook_secret=x_webhook_secret,
        x_api_key=x_api_key,
        authorization=authorization
    )
    target_cpf = cpf or data.cpf
    service = SimulationService(db)
    try:
        return await service.update_simulation_from_api(lead_id=lead_id, cpf=target_cpf, data=data)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

