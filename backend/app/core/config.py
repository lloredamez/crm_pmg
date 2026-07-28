import os
import secrets
import logging
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

def get_jwt_secret() -> str:
    secret = os.getenv("SECRET_KEY")
    if secret:
        return secret
    logger.warning("SECRET_KEY environment variable not set. Generating ephemeral secret key for session isolation.")
    return secrets.token_hex(32)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Lead CRM System API"
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
    SLA_TIMEOUT_MINUTES: int = int(os.getenv("SLA_TIMEOUT_MINUTES", "15"))

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
