# Faza 7 — Deploy + Xavfsizlik + Monitoring
> **Mas'ul:** Akramov Oybek
> **Vaqt:** Kun 2 · 15:00–18:00 (~3 soat)
> **Kerak:** Backend va Frontend asosan tayyor bo'lishi shart

---

## Kontekst

Deploy maqsadlari:
- **Backend (FastAPI):** Railway Pro → `https://eduflow-backend.railway.app`
- **Frontend (Next.js):** Vercel → `https://eduflow.vercel.app`
- **Database:** Supabase PostgreSQL → connection pooler orqali

---

## 7.1 — Backend Deploy (Railway)

### Dockerfile

`Dockerfile` (loyiha ildizida mavjud — tekshirish va to'ldirish):

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# uv o'rnatish
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Dependencylarni oldin ko'chirish (cache uchun)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Kod nusxalash
COPY backend/ ./backend/
COPY alembic/ ./alembic/
COPY alembic.ini ./

# Migration + server ishga tushirish
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]
```

### Railway Environment Variables

Railway dashboard → Project → Variables:

```
DATABASE_URL=postgresql+asyncpg://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?ssl=require
SECRET_KEY=<python -c "import secrets; print(secrets.token_hex(32))">
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
FRONTEND_URL=https://eduflow.vercel.app
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_MINUTES=10080
ALGORITHM=HS256
PORT=8000
```

> **Supabase connection pooler:** Settings → Database → Connection Pooling → Transaction mode → Port 6543
> asyncpg uchun: `connect_args={"statement_cache_size": 0}` qo'shish kerak

### Railway deploy

```bash
# Railway CLI o'rnatish
npm install -g @railway/cli

# Login va deploy
railway login
railway init  # yoki mavjud proyektga ulash
railway up    # deploy qilish
```

Yoki GitHub Integration: Railway dashboard → New Project → GitHub → repo tanlash → auto-deploy.

### Supabase asyncpg sozlamasi

`backend/db/session.py` ni tekshirish:

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Supabase pooler bilan asyncpg uchun:
engine = create_async_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},  # Supabase pooler uchun ZARUR
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
```

---

## 7.2 — Frontend Deploy (Vercel)

```bash
cd frontend
npm run build  # Avval lokal tekshirish

# Vercel deploy
npx vercel --prod
```

Yoki Vercel Dashboard → Import Git Repository → tanlash.

**Vercel Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://eduflow-backend.railway.app/api/v1
NEXT_PUBLIC_WS_URL=wss://eduflow-backend.railway.app
```

**`frontend/next.config.ts`:**
```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
```

---

## 7.3 — Xavfsizlik

### Rate Limiting

`backend/main.py`:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

`backend/api/routes/auth.py` da:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    ...
```

`backend/api/routes/ai.py` da:
```python
@router.post("/generate-course")
@limiter.limit("20/minute")
async def generate_course(request: Request, ...):
    ...
```

### CORS

`backend/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware
import os

ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_URL", "https://eduflow.vercel.app"),
    "http://localhost:3000",  # Local development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Input Validation

Barcha POST/PATCH endpointlarda Pydantic v2 sxemalari ishlatilayotganligini tekshirish:

```python
# Maximal uzunlik limiti:
class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    description: str = Field(..., max_length=5000)
    subject: str = Field(..., max_length=255)
```

### ENV tekshiruvi

`backend/core/config.py`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ANTHROPIC_API_KEY: str
    FRONTEND_URL: str = "http://localhost:3000"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"

settings = Settings()  # Startup da yetishmayotgan ENV xato beradi
```

---

## 7.4 — Health Check va Monitoring

`backend/main.py`:

```python
@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """DB ulanishini ham tekshiradi."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected", "version": "3.0.0"}
    except Exception as e:
        return {"status": "error", "db": str(e)}
```

**Uptime monitoring (bepul):** [UptimeRobot](https://uptimerobot.com) → `/health` endpoint ping 5 daqiqada bir.

---

## 7.5 — Demo ma'lumotlari (Seed Script)

`scripts/seed_demo.py` — demo uchun test ma'lumotlar:

```python
"""
Demo uchun test ma'lumotlar yaratish.
Ishga tushirish: python scripts/seed_demo.py
"""
import asyncio
import httpx

API_URL = "https://eduflow-backend.railway.app/api/v1"
# yoki "http://localhost:8000/api/v1"

async def seed():
    async with httpx.AsyncClient(base_url=API_URL) as client:

        # 1. Admin
        await client.post("/auth/register", json={
            "email": "admin@eduflow.uz",
            "password": "Admin123!",
            "full_name": "EduFlow Admin",
            "role": "admin"
        })

        # 2. Admin login
        res = await client.post("/auth/login", json={
            "email": "admin@eduflow.uz", "password": "Admin123!"
        })
        admin_token = res.json()["access_token"]
        headers_admin = {"Authorization": f"Bearer {admin_token}"}

        # 3. Org so'rov yuboruvchi
        await client.post("/auth/register", json={
            "email": "orgadmin@demo.uz",
            "password": "Demo123!",
            "full_name": "Demo Org Admin",
            "role": "student"
        })
        res = await client.post("/auth/login", json={
            "email": "orgadmin@demo.uz", "password": "Demo123!"
        })
        org_token = res.json()["access_token"]
        headers_org = {"Authorization": f"Bearer {org_token}"}

        # 4. Tashkilot so'rovi
        res = await client.post("/organizations/request", json={
            "name": "Buxoro Yangi Maktab",
            "type": "school",
            "address": "Buxoro shahar, Navoiy ko'chasi 15",
            "phone": "+998901234567",
            "stir": "123456789",
            "responsible_person": "Demo Org Admin"
        }, headers=headers_org)
        request_id = res.json()["id"]

        # 5. Admin tasdiqlash
        await client.put(f"/organizations/requests/{request_id}", json={
            "action": "approve"
        }, headers=headers_admin)

        # 6. Re-login org admin (yangi token bilan)
        res = await client.post("/auth/login", json={
            "email": "orgadmin@demo.uz", "password": "Demo123!"
        })
        org_token = res.json()["access_token"]
        headers_org = {"Authorization": f"Bearer {org_token}"}
        org_id = res.json()["user"]["org_id"]

        # 7. Teacher yaratish
        await client.post(f"/organizations/{org_id}/teachers", json={
            "email": "teacher@demo.uz",
            "full_name": "Demo O'qituvchi",
            "password": "Demo123!"
        }, headers=headers_org)

        # 8. Student yaratish
        await client.post(f"/organizations/{org_id}/students", json={
            "email": "student@demo.uz",
            "full_name": "Demo O'quvchi",
            "password": "Demo123!"
        }, headers=headers_org)

        print("✅ Demo ma'lumotlar yaratildi!")
        print(f"Admin: admin@eduflow.uz / Admin123!")
        print(f"Org-admin: orgadmin@demo.uz / Demo123!")
        print(f"Teacher: teacher@demo.uz / Demo123!")
        print(f"Student: student@demo.uz / Demo123!")

asyncio.run(seed())
```

```bash
python scripts/seed_demo.py
```

---

## 7.6 — Demo Stsenariy (5 daqiqa)

```
1. Admin (admin@eduflow.uz) kirib:
   → Org so'rovlar sahifasida "Buxoro Yangi Maktab" so'rovini tasdiqlaydi (30 sek)

2. Org-admin (orgadmin@demo.uz) kirib:
   → Sinflar → "9-A sinf" yaratadi
   → O'quvchi qo'shadi: "Demo O'quvchi"
   → Org dashboard statistikasini ko'rsatadi (30 sek)

3. Teacher (teacher@demo.uz) kirib:
   → "AI bilan kurs yarat" bosiladi
   → Fan: Matematika, Daraja: 9, Maqsad: "Kvadrat tenglamalar"
   → SSE stream ko'rsatiladi (30 sek AI generatsiya)
   → Kurs saqlanadi, mavzu ko'rsatiladi

4. Teacher:
   → "9-A sinf"ni kursga biriktiradi
   → 1 ta mavzuga kiradi, kontent ko'rsatiladi

5. Student (student@demo.uz) kirib:
   → Kurs ko'rinadi
   → Mavzuni o'qiydi (Markdown + LaTeX)
   → MCQ vazifani bajaradi
   → AI feedback ko'rinadi, XP qo'shiladi (40 sek)

6. Teacher:
   → "Blitz Jang" musobaqasi yaratadi
   → O'quvchilarni tanlaydi (AI guruh ajratish)
   → Musobaqani boshlaydi

7. Student:
   → Live sahifada savol ko'rinadi
   → Javob beradi → leaderboard yangilanadi

8. Teacher:
   → "Yakunlash" bosiladi → G'olib va MVP ko'rinadi
   → Dashboard statistika ko'rsatiladi
```

---

## Checklist (Deploy oldidan)

- [ ] `.env` da barcha kerakli ENV lar to'ldirilgan
- [ ] `alembic upgrade head` Railway da ishlaydi
- [ ] `GET /health` → `{"status": "ok", "db": "connected"}` qaytaradi
- [ ] `POST /auth/login` → token qaytaradi
- [ ] CORS header lari to'g'ri (`Access-Control-Allow-Origin: https://eduflow.vercel.app`)
- [ ] Frontend Vercel URL da ochiladi
- [ ] Login va token ishlaydi
- [ ] AI generate ishlaydi (test bilan)
- [ ] WebSocket ulanadi
- [ ] Seed demo data yuklangan
- [ ] Demo stsenariy bir marta to'liq o'tkazilgan

---

## Muvaffaqiyat mezoni

- [ ] `https://eduflow-backend.railway.app/health` — online
- [ ] `https://eduflow.vercel.app` — ochiladi
- [ ] Demo login lari ishlaydi
- [ ] AI kurs generatsiyasi 30 sekund ichida tugaydi
- [ ] Live musobaqa 3+ o'quvchi bilan ishlaydi
