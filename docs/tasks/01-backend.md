# Backend Developer — Vazifalar ro'yxati

**Rol:** Backend Developer
**Texnologiyalar:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Redis, Alembic, Celery
**Deploy:** Railway (backend) + Supabase (DB)

> Qaramlik: Backend fazalari Frontend uchun bloklovchi. BE-P1 va BE-P2 birinchi tugatilishi shart.

---

## Phase 0 — Setup `[DARHOL, ~1 soat, Kun 1 08:00–09:00]`

> Bu fazani barcha boshqa rollar bilan **parallel** bajarish mumkin.

- [ ] **BE-00-1** — Reponi clone qilish, virtual environment (uv): `uv sync`
- [ ] **BE-00-2** — `.env` faylini to'ldirish:
  ```
  DATABASE_URL=postgresql+asyncpg://...
  SECRET_KEY=<32 byte random>
  REDIS_URL=redis://...
  ANTHROPIC_API_KEY=sk-ant-...
  ACCESS_TOKEN_EXPIRE_MINUTES=15
  REFRESH_TOKEN_EXPIRE_MINUTES=10080
  ALGORITHM=HS256
  ```
- [ ] **BE-00-3** — PostgreSQL + Redis ulanishini tekshirish (ping/test query)
- [ ] **BE-00-4** — Alembic init: `alembic init alembic`, `alembic.ini` da DATABASE_URL sozlash
- [ ] **BE-00-5** — `backend/main.py` ga FastAPI app skeleton yozish (CORS middleware, health check endpoint)
- [ ] **BE-00-6** — Railway + Supabase proyektlarini yaratish, ulanish string olish

**Muvaffaqiyat:** `GET /health` → `{"status": "ok"}` ishlaydi, DB va Redis ulanadi.

---

## Phase 1 — DB Models + Migrations `[KETMA-KET, ~2 soat, Kun 1 09:00–11:00]`

> Bu faza **BE-P2 uchun bloklovchi**. Boshqa backend fazalar bu bilan parallel boshlanmaydi.

### `backend/db/models/` fayllar:

- [ ] **BE-01-1** — `user.py`: `User` modeli
  ```python
  # Maydonlar: id (UUID), email (unique), password_hash, full_name,
  # role (teacher/student/admin), avatar_url, xp (default=0),
  # level (default=1), streak_count (default=0), streak_last_date,
  # created_at, updated_at
  ```
- [ ] **BE-01-2** — `course.py`: `Course` + `CourseModule` modellari
  ```python
  # Course: id, teacher_id (FK→User), title, description, subject,
  #         difficulty, cover_url, is_ai_generated, status (draft/published), created_at
  # CourseModule: id, course_id (FK), title, content_md, order_num, is_published
  ```
- [ ] **BE-01-3** — `class_.py`: `Class` + `ClassEnrollment` modellari
  ```python
  # Class: id, teacher_id (FK), name, subject, class_code (6 chars, unique), academic_year
  # ClassEnrollment: id, class_id (FK), student_id (FK), enrolled_at, status
  ```
- [ ] **BE-01-4** — `assignment.py`: `Assignment` + `Question` modellari
  ```python
  # Assignment: id, course_id, teacher_id, title, instructions,
  #             question_type (mcq/fill/match/order/open/timed),
  #             time_limit_sec, max_attempts, deadline, is_ai_generated
  # Question: id, assignment_id, question_text, question_type,
  #           options_json, correct_answer_json, rubric_json, order_num, points_max
  ```
- [ ] **BE-01-5** — `submission.py`: `Submission` + `SubmissionResult` + `UserProgress` + `Achievement` + `AILog`
  ```python
  # Submission: id, assignment_id, student_id, answers_json, submitted_at,
  #             attempt_num, status (pending/ai_reviewed/teacher_confirmed)
  # SubmissionResult: id, submission_id, question_id, student_answer,
  #                   ai_score, ai_feedback, teacher_score, teacher_note,
  #                   is_correct, xp_earned
  # UserProgress: id, user_id, course_id, module_id, completed_at, xp_earned
  # Achievement: id, user_id, badge_type, earned_at, metadata_json
  # AILog: id, user_id, endpoint, prompt_hash, tokens_used, response_ms, created_at
  ```
- [ ] **BE-01-6** — `backend/db/__init__.py`ga barcha modellarni import qilish
- [ ] **BE-01-7** — `backend/db/base.py`: SQLAlchemy async engine + session factory
  ```python
  # engine = create_async_engine(DATABASE_URL, pool_size=5, max_overflow=15)
  # AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
  ```
- [ ] **BE-01-8** — Alembic migration: `alembic revision --autogenerate -m "initial"` → `alembic upgrade head`
- [ ] **BE-01-9** — `backend/api/deps.py`: dependency injection
  ```python
  # get_db() → AsyncSession
  # get_current_user() → User (JWT decode qiladi)
  # require_teacher() → User (role=teacher tekshiradi, 403 qaytaradi)
  # require_student() → User (role=student tekshiradi)
  ```

**Muvaffaqiyat:** `alembic upgrade head` xatosiz chiqadi, barcha jadvallar DB da ko'rinadi.

---

## Phase 2 — Auth Endpoints `[KETMA-KET, ~2 soat, Kun 1 09:00–11:00]`

> BE-P1 bilan **parallel** boshlanishi mumkin, lekin `get_current_user` dep uchun BE-01-9 kerak.
> Bu faza **FE-P1 uchun bloklovchi** — login sahifasi shu endpointlarga bog'liq.

- [ ] **BE-02-1** — `backend/schemas/auth.py`: Pydantic sxemalar
  ```python
  # RegisterRequest: email, password, full_name, role
  # LoginRequest: email, password
  # TokenResponse: access_token, refresh_token, token_type
  # UserResponse: id, email, full_name, role, xp, level, streak_count
  ```
- [ ] **BE-02-2** — `backend/repositories/user_repo.py`: `UserRepository`
  ```python
  # get_by_email(email) → User | None
  # create(data) → User
  # update_xp(user_id, xp_delta) → User
  # update_streak(user_id) → User
  ```
- [ ] **BE-02-3** — `backend/services/auth_service.py`: auth biznes logika
  ```python
  # register(data) → (User, tokens)  # hash_password ishlatadi
  # login(email, password) → (User, tokens)  # verify_password ishlatadi
  # refresh(refresh_token) → new access_token
  # logout(refresh_token) → None  # Redis blacklist
  ```
- [ ] **BE-02-4** — `backend/api/routes/auth.py`: route handler
  ```
  POST /api/v1/auth/register     → PUBLIC
  POST /api/v1/auth/login        → PUBLIC
  POST /api/v1/auth/refresh      → PUBLIC
  POST /api/v1/auth/logout       → AUTH
  GET  /api/v1/auth/me           → AUTH
  PATCH /api/v1/auth/me          → AUTH
  POST /api/v1/auth/change-password → AUTH
  ```
- [ ] **BE-02-5** — Redis `session_store.py`: refresh token blacklist (`SETEX token_hash 604800 "blacklisted"`)
- [ ] **BE-02-6** — Router ni `main.py` ga qo'shish

**Muvaffaqiyat:** `POST /auth/register` + `POST /auth/login` → JWT tokenlar qaytaradi. `GET /auth/me` auth header bilan ishlaydi.

---

## Phase 3 — Courses & Classes `[PARALLEL BE-P2 bilan, ~2 soat, Kun 1 11:00–13:00]`

> BE-P2 (auth) tayyor bo'lgandan keyin boshlanadi. FE-P2 (dashboard) shu endpointlarga bog'liq.

- [ ] **BE-03-1** — `backend/schemas/course.py`: `CourseCreate`, `CourseUpdate`, `CourseResponse`, `ModuleCreate`
- [ ] **BE-03-2** — `backend/repositories/course_repo.py`: CRUD + `get_by_teacher`, `get_enrolled_by_student`
- [ ] **BE-03-3** — `backend/api/routes/courses.py`:
  ```
  GET    /api/v1/courses              → AUTH (rol bo'yicha filter)
  POST   /api/v1/courses              → TEACHER
  GET    /api/v1/courses/{id}         → AUTH
  PATCH  /api/v1/courses/{id}         → TEACHER (owner tekshiruvi)
  DELETE /api/v1/courses/{id}         → TEACHER (soft delete)
  POST   /api/v1/courses/{id}/publish → TEACHER
  POST   /api/v1/courses/{id}/modules        → TEACHER
  PATCH  /api/v1/courses/{id}/modules/{mid}  → TEACHER
  DELETE /api/v1/courses/{id}/modules/{mid}  → TEACHER
  ```
- [ ] **BE-03-4** — `backend/schemas/class_.py` + `backend/repositories/class_repo.py`
- [ ] **BE-03-5** — 6 belgili sinf kodi generatsiya funksiyasi (unique tekshiruvi bilan)
  ```python
  import secrets, string
  def generate_class_code() -> str:
      chars = string.ascii_uppercase + string.digits
      return ''.join(secrets.choice(chars) for _ in range(6))
  ```
- [ ] **BE-03-6** — `backend/api/routes/classes.py`:
  ```
  GET    /api/v1/classes               → TEACHER
  POST   /api/v1/classes               → TEACHER (auto class_code)
  POST   /api/v1/classes/join          → STUDENT (sinf kodini kiritib a'zo bo'lish)
  POST   /api/v1/classes/{id}/enroll   → TEACHER (kursni sinfga biriktirish)
  GET    /api/v1/classes/{id}/students → TEACHER
  DELETE /api/v1/classes/{id}/students/{sid} → TEACHER
  ```
- [ ] **BE-03-7** — `course_enrollments` jadvalini to'g'ri to'ldirish logikasi

**Muvaffaqiyat:** O'qituvchi sinf yarata oladi, 6 belgili kod ko'rinadi. O'quvchi kod bilan ulanadi.

---

## Phase 4 — Assignments `[KETMA-KET BE-P3 dan keyin, ~2 soat, Kun 1 17:00–19:00]`

- [ ] **BE-04-1** — `backend/schemas/assignment.py`: barcha 6 format uchun sxemalar
  ```python
  # AssignmentCreate, MCQQuestion, FillQuestion, MatchQuestion,
  # OrderQuestion, OpenQuestion, TimedQuizQuestion
  ```
- [ ] **BE-04-2** — `backend/repositories/assignment_repo.py` + `question_repo.py`
- [ ] **BE-04-3** — `backend/api/routes/assignments.py`:
  ```
  POST /api/v1/assignments              → TEACHER
  GET  /api/v1/assignments/{id}         → AUTH
  POST /api/v1/assignments/{id}/submit  → STUDENT (AI baholash trigger)
  GET  /api/v1/assignments/{id}/results → AUTH (rol bo'yicha)
  POST /api/v1/submissions/{id}/confirm → TEACHER (ochiq savol tasdiqlash)
  ```
- [ ] **BE-04-4** — Submission save + attempt_num hisoblash logikasi
- [ ] **BE-04-5** — MCQ/Fill avtomatik baholash (AI chaqiruvsiz, deterministik):
  ```python
  # MCQ: answer == correct_index
  # Fill: answer.lower().strip() in correct_answers (semantic tahlil AI bilan)
  ```

**Muvaffaqiyat:** O'qituvchi MCQ vazifa yaratadi. O'quvchi javob yuboradi. Natija saqlanadi.

---

## Phase 5 — AI Integration `[PARALLEL BE-P4 bilan, ~3 soat, Kun 1 14:00–17:00]`

> AI Engineer bilan **birgalikda** ishlash kerak (prompt AI Engineer yozadi, endpoint shu yerda).

- [ ] **BE-05-1** — `backend/services/ai_service.py`: Claude SDK wrapper
  ```python
  async def stream_course_generation(subject, level, goal, module_count) → AsyncGenerator[str]
  async def stream_assignment_generation(topic, difficulty, question_type, count) → AsyncGenerator[str]
  async def grade_open_answer(question, model_answer, student_answer, max_points) → GradeResult
  ```
- [ ] **BE-05-2** — `backend/api/routes/ai.py`:
  ```
  POST /api/v1/courses/ai-generate       → TEACHER (SSE streaming)
  POST /api/v1/assignments/ai-generate   → TEACHER (SSE streaming)
  GET  /api/v1/ai/status/{task_id}       → AUTH (Celery task status)
  ```
- [ ] **BE-05-3** — SSE streaming response: `StreamingResponse` + `text/event-stream`
  ```python
  async def event_generator():
      async for chunk in stream_course_generation(...):
          yield f"data: {chunk}\n\n"
  return StreamingResponse(event_generator(), media_type="text/event-stream")
  ```
- [ ] **BE-05-4** — AI grading integratsiyasi: submission submit bo'lganda background task boshlanadi
- [ ] **BE-05-5** — `AILog` jadvalga har AI chaqiruvdan yozish:
  ```python
  # hashlib.sha256(prompt.encode()).hexdigest() → prompt_hash
  # response_ms, tokens_used saqlanadi
  ```
- [ ] **BE-05-6** — Celery setup (`backend/celery_app.py`) + Redis broker uchun konfiguratsiya
- [ ] **BE-05-7** — Prompt injection sanitizatsiya:
  ```python
  import bleach
  def sanitize_input(text: str) -> str:
      return bleach.clean(text, tags=[], strip=True)[:2000]
  ```

**Muvaffaqiyat:** `POST /courses/ai-generate` SSE stream qaytaradi. Token-token matn keladi.

---

## Phase 6 — Dashboard APIs `[KETMA-KET BE-P5 dan keyin, ~2 soat, Kun 2 10:00–12:00]`

- [ ] **BE-06-1** — XP va streak yangilash logikasi (`services/gamification_service.py`):
  ```python
  # xp_actions = {MCQ_FIRST: 30, MCQ_SECOND: 15, STREAK_DAILY: 10, ...}
  # level_thresholds = [0, 500, 1500, 3500, 7000, 15000]
  # streak: bugungi sana streak_last_date dan 1 kun keyin bo'lsa → +1, aks holda reset
  ```
- [ ] **BE-06-2** — `GET /api/v1/dashboard/teacher`:
  ```json
  {
    "classes": [{"name": "...", "student_count": N, "active_assignments": N}],
    "pending_reviews": [{"submission_id": "...", "student": "..."}],
    "recent_activity": [...],
    "problem_questions": [{"question_id": "...", "error_rate": 0.7}]
  }
  ```
- [ ] **BE-06-3** — `GET /api/v1/dashboard/student`:
  ```json
  {
    "xp": 1250, "level": 2, "streak_count": 5,
    "active_courses": [...], "recent_achievements": [...]
  }
  ```
- [ ] **BE-06-4** — `GET /api/v1/assignments/{id}/results` (teacher uchun: hamma, student: o'zi)
- [ ] **BE-06-5** — Achievement trigger logikasi (streak 3/7/30 kun nishonlari)

**Muvaffaqiyat:** Teacher dashboard API sinf statistikasini qaytaradi. Student XP va streak ko'radi.

---

## Phase 7 — Security Hardening `[PARALLEL polish bilan, ~1 soat, Kun 2 13:00–14:00]`

- [ ] **BE-07-1** — `slowapi` rate limiting middleware:
  ```python
  # Umumiy: 100/minute
  # /auth/login: 5/minute (brute-force himoya)
  # /ai/*: 20/minute/user
  ```
- [ ] **BE-07-2** — CORS sozlamalari:
  ```python
  ALLOWED_ORIGINS = [os.getenv("FRONTEND_URL", "https://eduflow.vercel.app")]
  # * wildcard HECH QACHON ishlatilmaydi
  ```
- [ ] **BE-07-3** — Security headers middleware (CSP, X-Frame-Options, HSTS)
- [ ] **BE-07-4** — HTTPS redirect middleware (HTTP → HTTPS)
- [ ] **BE-07-5** — `.env` validation: startup da barcha kerakli ENV lar mavjudligini tekshirish

**Muvaffaqiyat:** `curl -I https://...` → HSTS, X-Frame-Options headerlar ko'rinadi.

---

## Phase 8 — Docker + Deploy `[PARALLEL polish bilan, ~1 soat, Kun 2]`

- [ ] **BE-08-1** — `Dockerfile` (hozir placeholder — to'liq qilish kerak):
  ```dockerfile
  FROM python:3.12-slim
  WORKDIR /app
  COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
  COPY pyproject.toml uv.lock ./
  RUN uv sync --frozen --no-dev
  COPY backend/ ./backend/
  CMD ["uv", "run", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```
- [ ] **BE-08-2** — `docker-compose.yml` (hozir bo'sh — yozish kerak):
  ```yaml
  services:
    app: {build: ., ports: ["8000:8000"], env_file: .env, depends_on: [db, redis]}
    db: {image: postgres:16, environment: {...}, volumes: [...]}
    redis: {image: redis:7-alpine}
    celery: {build: ., command: "celery -A backend.celery_app worker"}
  ```
- [ ] **BE-08-3** — Supabase connection pooler sozlash (Railway deploy oldidan):
  ```
  Supabase → Settings → Database → Connection Pooling → "Transaction" mode
  Port: 6543 (pooler), standart 5432 emas

  DATABASE_URL (Railway uchun):
  postgresql+asyncpg://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?ssl=require

  SQLAlchemy sozlamasi — pooler bilan:
  create_async_engine(DATABASE_URL, pool_size=5, max_overflow=10)
  # NB: Statement-level prepared statements o'chirilishi kerak asyncpg uchun:
  connect_args={"statement_cache_size": 0}
  ```
- [ ] **BE-08-4** — Railway deploy: `railway up` yoki GitHub CI/CD
- [ ] **BE-08-5** — Alembic migration Railway da avtomatik ishga tushishi:
  ```bash
  railway run alembic upgrade head
  # yoki Dockerfile ga:
  # CMD alembic upgrade head && uvicorn backend.main:app ...
  ```

**Muvaffaqiyat:** `docker compose up` — barcha servislar ishlaydi. Railway URL ochiq.

---

## Fayllar ro'yxati (yaratilishi kerak):

```
backend/
├── main.py                          ← BE-00-5
├── celery_app.py                    ← BE-05-6
├── core/
│   ├── config.py                    ✅ (mavjud)
│   └── security.py                  ✅ (mavjud)
├── db/
│   ├── base.py                      ← BE-01-7
│   └── models/
│       ├── user.py                  ← BE-01-1
│       ├── course.py                ← BE-01-2
│       ├── class_.py                ← BE-01-3
│       ├── assignment.py            ← BE-01-4
│       └── submission.py            ← BE-01-5
├── repositories/
│   ├── user_repo.py                 ← BE-02-2
│   ├── course_repo.py               ← BE-03-2
│   ├── class_repo.py                ← BE-03-4
│   └── assignment_repo.py           ← BE-04-2
├── schemas/
│   ├── auth.py                      ← BE-02-1
│   ├── course.py                    ← BE-03-1
│   ├── class_.py                    ← BE-03-4
│   └── assignment.py                ← BE-04-1
├── services/
│   ├── auth_service.py              ← BE-02-3
│   ├── ai_service.py                ← BE-05-1
│   └── gamification_service.py     ← BE-06-1
└── api/
    ├── deps.py                      ← BE-01-9
    └── routes/
        ├── auth.py                  ← BE-02-4
        ├── courses.py               ← BE-03-3
        ├── classes.py               ← BE-03-6
        ├── assignments.py           ← BE-04-3
        ├── ai.py                    ← BE-05-2
        └── dashboard.py             ← BE-06-2,3
```
