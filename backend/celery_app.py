"""Celery application — EduFlow task queue.

Foydalanish:
    # Worker ishga tushirish (local):
    uv run celery -A backend.celery_app worker --loglevel=info -Q celery,ai_tasks

    # Flower monitoring (local):
    uv run celery -A backend.celery_app flower --port=5555

    # Docker da (make up-workers):
    docker compose --profile workers up -d
"""
import os

from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Broker & Backend URLs
# ---------------------------------------------------------------------------
# Docker ichida: redis://:pass@redis:6379
# Local host da:  redis://:pass@localhost:16379
CELERY_BROKER_URL = os.getenv(
    "CELERY_BROKER_URL",
    "redis://:eduflow_redis_pass@localhost:16379/0",
)
CELERY_RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND",
    "redis://:eduflow_redis_pass@localhost:16379/1",
)

# ---------------------------------------------------------------------------
# Celery app
# ---------------------------------------------------------------------------
celery_app = Celery(
    "eduflow",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        "backend.tasks.ai_tasks",      # AI generation + grading tasks
        "backend.tasks.notification",  # Email / push notifications (future)
    ],
)

# ---------------------------------------------------------------------------
# Konfiguratsiya
# ---------------------------------------------------------------------------
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="Asia/Tashkent",
    enable_utc=True,
    # Task routing — ikkita navbat:
    #   celery    → umumiy tasklar
    #   ai_tasks  → og'ir AI operatsiyalari (alohida worker bilan scale qilish mumkin)
    task_routes={
        "backend.tasks.ai_tasks.*": {"queue": "ai_tasks"},
    },
    # Worker sozlamalari
    worker_prefetch_multiplier=1,       # AI tasklari uzoq, prefetch kerak emas
    task_acks_late=True,                # task muvaffaqiyatli bo'lgach tasdiqlash
    task_reject_on_worker_lost=True,    # worker o'lsa — task navbatga qaytsin
    # Result expiry (24 soat)
    result_expires=86_400,
    # Retry sozlamalari (default)
    task_max_retries=3,
    task_default_retry_delay=60,        # 1 daqiqa kutish
)

# ---------------------------------------------------------------------------
# Oddiy alias (import convenience)
# ---------------------------------------------------------------------------
app = celery_app
