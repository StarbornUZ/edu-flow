"""Alembic migration environment — async PostgreSQL uchun sozlangan."""
import asyncio
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import pool

from alembic import context

# ---------------------------------------------------------------------------
# Alembic config
# ---------------------------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Modellarni import qilish — autogenerate uchun ZARUR
# ---------------------------------------------------------------------------
from backend.db.base import Base           # noqa: E402
from backend.db.models import *            # noqa: E402, F401, F403  # barcha modellar (autogenerate uchun)

target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# DATABASE_URL — .env dan olish
# ---------------------------------------------------------------------------
from backend.core.config import DATABASE_URL   # noqa: E402

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL sozlanmagan!\n"
        ".env faylga qo'shing:\n"
        "DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname\n\n"
        "Maslahat: Supabase yoki Railway dan bepul PostgreSQL oling."
    )

# alembic.ini dagi placeholder ni .env dan olingan URL bilan almashtirish
config.set_main_option("sqlalchemy.url", DATABASE_URL)


# ---------------------------------------------------------------------------
# Offline mode — DB ulanishsiz SQL faylga yozish
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,          # column type o'zgarishlarini aniqlash
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online mode — to'g'ridan-to'g'ri DB ga qo'llash (async)
# ---------------------------------------------------------------------------
def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(
        DATABASE_URL,
        poolclass=pool.NullPool,   # migration da pooling kerak emas
    )
    async with engine.begin() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
