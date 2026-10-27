import urllib.parse
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.auth import LoginRequest, Token, UserCreateWithPassword
from app.schemas.user import UserResponse
from app.models.user import User
from app.features.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    login_in: Optional[LoginRequest] = None
    content_type = request.headers.get("content-type", "").lower()

    # Suporte para o botão "Authorize" do Swagger UI (x-www-form-urlencoded)
    if "application/x-www-form-urlencoded" in content_type:
        raw_body = await request.body()
        form_data = urllib.parse.parse_qs(raw_body.decode("utf-8"))
        username = form_data.get("username", [""])[0]
        password = form_data.get("password", [""])[0]
        login_in = LoginRequest(
            identifier=username,
            email=username,
            username=username,
            password=password
        )
    elif "multipart/form-data" in content_type:
        try:
            form = await request.form()
            username = form.get("username", "")
            password = form.get("password", "")
            login_in = LoginRequest(
                identifier=str(username),
                email=str(username),
                username=str(username),
                password=str(password)
            )
        except Exception:
            pass

    # Suporte para requisições com payload JSON (Frontend ou testes diretos)
    if not login_in:
        try:
            body_json = await request.json()
            login_in = LoginRequest(**body_json)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Parâmetros de autenticação inválidos: {str(e)}"
            )

    if not login_in.password or not login_in.get_login_identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador (e-mail/CPF/usuário) e senha são obrigatórios."
        )

    service = AuthService(db)
    token = await service.authenticate(login_in)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos"
        )
    return token

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_in: UserCreateWithPassword, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.create_user_with_password(user_in)
