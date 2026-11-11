from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.bank import Bank
from app.schemas.bank import BankResponse

router = APIRouter(prefix="/banks", tags=["Bancos"])

@router.get("", response_model=List[BankResponse])
async def list_banks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lista as instituições bancárias ativas cadastradas no sistema ordenadas por código e nome."""
    query = select(Bank).where(Bank.is_active == True).order_by(Bank.code.asc(), Bank.name.asc())
    result = await db.execute(query)
    return result.scalars().all()

