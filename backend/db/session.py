"""Async engine va session factory — lazy initialization.

Engine birinchi marta `get_engine()` chaqirilganda yaratiladi.
Shu tufayli modellar import bo'lganda DB ulanishi kerak emas.

Foydalanish:
    from backend.db.session import get_session_factory

    async with get_session_factory()() as session:
        ...
"""
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from backend.core.config import DATABASE_URL

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker | None = None


def get_engine() -> AsyncEngine:
    """Async engine — lazily yaratiladi."""
    global _engine
    if _engine is None:
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL muhit o'zgaruvchisi sozlanmagan!\n"
                ".env faylga qo'shing:\n"
                "DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname"
            )
        _engine = create_async_engine(
            DATABASE_URL,
            pool_size=5,
            max_overflow=15,
            pool_pre_ping=True,
            echo=False,
        )
    assert _engine is not None
    return _engine


def get_session_factory() -> async_sessionmaker:
    """Session factory — lazily yaratiladi."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    assert _session_factory is not None
    return _session_factory


# Backwards compatibility alias — engine va AsyncSessionLocal to'g'ridan import uchun
# (alembic env.py va boshqa yerlar uchun)
class _LazyEngine:
    """engine.begin(), engine.dispose() kabi metodlarni lazy qo'llab-quvvatlash."""

    def __getattr__(self, name):
        return getattr(get_engine(), name)


engine = _LazyEngine()
AsyncSessionLocal = None  # get_session_factory() ishlatilsin
