from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.security import verify_password, get_password_hash, create_access_token
from app.schemas.auth import LoginRequest, Token, UserCreateWithPassword
from app.schemas.user import UserResponse

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate(self, login_in: LoginRequest) -> Optional[Token]:
        result = await self.db.execute(select(User).where(User.email == login_in.email))
        user = result.scalar_one_or_none()
        if not user:
            return None
        if not verify_password(login_in.password, user.hashed_password):
            return None
        
        access_token = create_access_token(subject=str(user.id))
        return Token(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )

    async def create_user_with_password(self, user_in: UserCreateWithPassword) -> User:
        hashed_password = get_password_hash(user_in.password)
        user = User(
            name=user_in.name,
            email=user_in.email,
            hashed_password=hashed_password,
            role=user_in.role,
            status=user_in.status,
            max_simultaneous_leads=user_in.max_simultaneous_leads
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
