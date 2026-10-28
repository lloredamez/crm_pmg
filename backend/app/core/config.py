import os
import secrets
import logging
from typing import Optional
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

def get_jwt_secret() -> str:
    secret = os.getenv("SECRET_KEY")
    if secret:
        return secret
    logger.warning("SECRET_KEY environment variable not set. Generating ephemeral secret key for session isolation.")
    return secrets.token_hex(32)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Lead CRM"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "crm_leads")
    
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    
    SECRET_KEY: str = get_jwt_secret()
    META_VERIFY_TOKEN: str = os.getenv("META_VERIFY_TOKEN", "lead_crm_meta_token_secret")
    META_APP_SECRET: Optional[str] = os.getenv("META_APP_SECRET", None)
    WEBHOOK_SECRET: Optional[str] = os.getenv("WEBHOOK_SECRET", None)
    SLA_TIMEOUT_MINUTES: int = int(os.getenv("SLA_TIMEOUT_MINUTES", "15"))
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5051,http://localhost:3000,http://127.0.0.1:5051")

    @property
    def CORS_ORIGINS(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

settings = Settings()
