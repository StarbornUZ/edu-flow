# EduFlow -- Makefile
# Windows (Git Bash) + Linux cross-platform
#
# Foydalanish:
#   make help       -> barcha buyruqlar
#   make up         -> core infra (postgres + redis)
#   make dev        -> dev server (hot-reload)
#   make network    -> local tarmoq URL lari

SHELL        := bash
.SHELLFLAGS  := -c
COMPOSE      := docker compose
COMPOSE_FILE := docker-compose.yml

-include .env
export

.DEFAULT_GOAL := help

.PHONY: help \
        up up-tools up-workers up-app up-all \
        down reset \
        build build-prod pull \
        logs logs-postgres logs-redis logs-backend logs-celery \
        shell-db shell-redis shell-backend \
        ps status \
        migrate migrate-down migrate-history migration \
        dev \
        ip network \
        install install-dev setup

# ============================================================
# HELP
# ============================================================
help: ## Barcha buyruqlarni ko'rsatish
	uv run python scripts/make_help.py

# ============================================================
# INFRA -- Ishga tushirish
# ============================================================
up: ## Core infra: PostgreSQL + Redis
	$(COMPOSE) -f $(COMPOSE_FILE) up -d postgres redis
	@echo "PostgreSQL: localhost:15432"
	@echo "Redis:      localhost:16379"

up-tools: ## Core + pgAdmin + Mailpit
	$(COMPOSE) -f $(COMPOSE_FILE) --profile tools up -d
	@echo "PostgreSQL: localhost:15432  |  Redis: localhost:16379"
	@echo "pgAdmin:    http://localhost:15050"
	@echo "Mailpit:    http://localhost:15025  (SMTP: localhost:11025)"

up-workers: ## Core + Celery Worker + Flower
	$(COMPOSE) -f $(COMPOSE_FILE) --profile workers up -d
	@echo "Flower: http://localhost:15555"

up-app: ## Core + Backend API (Docker containerda)
	$(COMPOSE) -f $(COMPOSE_FILE) --profile app up -d
	@echo "Backend: http://localhost:18000"

up-all: ## Hammasi: core + tools + workers + app
	$(COMPOSE) -f $(COMPOSE_FILE) --profile all up -d
	@echo ""
	@echo "  PostgreSQL : localhost:15432"
	@echo "  Redis      : localhost:16379"
	@echo "  pgAdmin    : http://localhost:15050"
	@echo "  Mailpit    : http://localhost:15025"
	@echo "  Flower     : http://localhost:15555"
	@echo "  Backend    : http://localhost:18000"

# ============================================================
# INFRA -- To'xtatish / Tozalash
# ============================================================
down: ## Barcha konteynerlarni to'xtatish
	$(COMPOSE) -f $(COMPOSE_FILE) --profile all down

reset: ## To'xtatish + volumelarni o'chirish (ma'lumotlar yo'qoladi!)
	@echo "DIQQAT: Barcha ma'lumotlar o'chiriladi!"
	$(COMPOSE) -f $(COMPOSE_FILE) --profile all down -v --remove-orphans

# ============================================================
# BUILD
# ============================================================
build: ## Docker image qurilish (development)
	$(COMPOSE) -f $(COMPOSE_FILE) build

build-prod: ## Production Docker image qurilish
	docker build --target production -t eduflow_backend:latest .

pull: ## Barcha imagelarni yangilash
	$(COMPOSE) -f $(COMPOSE_FILE) pull

# ============================================================
# LOGS
# ============================================================
logs: ## Barcha servislar loglari (Ctrl+C -- to'xtatish)
	$(COMPOSE) -f $(COMPOSE_FILE) --profile all logs -f --tail=50

logs-postgres: ## PostgreSQL loglari
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=100 postgres

logs-redis: ## Redis loglari
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=100 redis

logs-backend: ## Backend API loglari
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=200 backend

logs-celery: ## Celery Worker loglari
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f --tail=200 celery_worker

# ============================================================
# SHELL / DEBUG
# ============================================================
shell-db: ## PostgreSQL psql konsoliga kirish
	$(COMPOSE) -f $(COMPOSE_FILE) exec postgres \
		psql -U $${POSTGRES_USER:-eduflow} -d $${POSTGRES_DB:-eduflow}

shell-redis: ## Redis CLI ga kirish
	$(COMPOSE) -f $(COMPOSE_FILE) exec redis \
		redis-cli -a $${REDIS_PASSWORD:-eduflow_redis_pass}

shell-backend: ## Backend konteynerida bash
	$(COMPOSE) -f $(COMPOSE_FILE) exec backend bash

ps: ## Ishlaydigan konteynerlar ro'yxati
	$(COMPOSE) -f $(COMPOSE_FILE) --profile all ps

status: ps ## ps ga alias

# ============================================================
# DATABASE / MIGRATIONS
# ============================================================
migrate: ## Alembic migratsiyalarini qo'llash (upgrade head)
	uv run alembic upgrade head

migrate-down: ## Oxirgi migratsiyani bekor qilish
	uv run alembic downgrade -1

migrate-history: ## Migratsiya tarixini ko'rsatish
	uv run alembic history --verbose

migration: ## Yangi migratsiya: make migration name="add_users"
ifndef name
	$(error "name kerak: make migration name='migration_name'")
endif
	uv run alembic revision --autogenerate -m "$(name)"

# ============================================================
# DEV SERVER
# ============================================================
dev: ## Dev server (host da, hot-reload, cross-platform)
	uv run uvicorn backend.main:app \
		--host 0.0.0.0 \
		--port 8000 \
		--reload \
		--reload-dir backend

# ============================================================
# TARMOQ
# ============================================================
ip: ## Local tarmoq IP manzilini ko'rsatish
	uv run python scripts/local_network.py --ip-only

network: ## Barcha local tarmoq URL larini ko'rsatish
	uv run python scripts/local_network.py

# ============================================================
# INSTALL / SETUP
# ============================================================
install: ## Python dependencylarni o'rnatish (uv sync)
	uv sync

install-dev: ## Dev dependencylar bilan o'rnatish
	uv sync --group dev

setup: ## Yangi muhit uchun to'liq setup
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env yaratildi, tahrirlang!"; fi
	uv sync
	$(COMPOSE) -f $(COMPOSE_FILE) up -d postgres redis
	@echo "PostgreSQL tayyor bolishi kutilmoqda (10s)..."
	@sleep 10
	uv run alembic upgrade head
	@echo "Setup tugadi! -> make dev"
