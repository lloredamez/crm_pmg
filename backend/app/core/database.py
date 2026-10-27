from contextlib import asynccontextmanager
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=False,
    future=True,
    pool_size=20,
    max_overflow=10
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

@asynccontextmanager
async def get_worker_session() -> AsyncGenerator[AsyncSession, None]:
    """Cria uma sessão isolada com NullPool para Celery tasks/workers.
    Garante que conexões asyncpg não sejam compartilhadas entre diferentes loops de eventos.
    """
    worker_engine = create_async_engine(
        settings.ASYNC_DATABASE_URL,
        poolclass=NullPool,
        echo=False
    )
    worker_session_maker = async_sessionmaker(
        bind=worker_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False
    )
    async with worker_session_maker() as session:
        try:
            yield session
        finally:
            await worker_engine.dispose()

