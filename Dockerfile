# EduFlow Backend — multi-stage Dockerfile
#
# Stage-lar:
#   base       → umumiy asos (Python + uv + system deps)
#   builder    → dependency lar o'rnatiladi (cache uchun)
#   development → hot-reload bilan dev server
#   production → minimal final image

# ============================================================
# Stage 1: base
# ============================================================
FROM python:3.12-slim AS base

# Metadata
LABEL maintainer="EduFlow Team"
LABEL description="EduFlow AI Education Platform — Backend API"

# System paketlar (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# uv o'rnatish (eng tez Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Non-root user (xavfsizlik)
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# ============================================================
# Stage 2: builder  (dependency lar — cache layer)
# ============================================================
FROM base AS builder

# Dependency fayllarini nusxalash (kod o'zgarsa cache buzilmaydi)
COPY pyproject.toml uv.lock ./

# Virtual environment yaratish va dependency lar o'rnatish
# --extra linux: uvloop (Linux-only, Windows da ishlamaydi)
RUN uv sync --frozen --no-dev --no-install-project --extra linux

# ============================================================
# Stage 3: development  (make dev-docker)
# ============================================================
FROM base AS development

# Dev dependency lar (test, linting) ham kerak
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# Kod nusxalanmaydi — volume mount bilan hot-reload ishlaydi
# docker-compose da: volumes: [./:/app]

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--reload"]

# ============================================================
# Stage 4: production  (asosiy stage)
# ============================================================
FROM base AS production

# Builder dan virtual environment ni ko'chirish
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv

# Ilovani nusxalash (faqat kerakli fayllar)
COPY --chown=appuser:appgroup backend/ ./backend/
COPY --chown=appuser:appgroup alembic/ ./alembic/
COPY --chown=appuser:appgroup alembic.ini ./

# Non-root user bilan ishga tushirish
USER appuser

# Port
EXPOSE 8000

# Sog'lom-holat tekshiruvi
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default: uvicorn production server
# Override qilish: docker run ... celery -A backend.celery_app worker
CMD ["uv", "run", "uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--loop", "uvloop"]
# uvloop faqat Linux da ishlaydi — Docker image Linux asosida quriladi,
# shuning uchun --loop uvloop xavfsiz.
