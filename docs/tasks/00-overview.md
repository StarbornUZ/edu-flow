# EduFlow — Project Overview & Task Chain

> **National AI Hackathon | Buxoro bosqichi | 10–15 aprel 2026**
> Stack: FastAPI + Next.js 14 + PostgreSQL + Redis + Claude API

---

## Loyiha haqida qisqacha

**EduFlow** — o'qituvchi + o'quvchi uchun AI-asosidagi interaktiv ta'lim platformasi.

```
O'qituvchi kurs yaratadi (AI bilan)
    → Sinf + o'quvchi qo'shadi
        → Vazifa chiqaradi (6 format)
            → O'quvchi yechadi
                → AI tekshiradi + XP beradi
                    → O'qituvchi dashboardda natijani ko'radi
```

**Demo zanjiri (5 daqiqa):** Login → AI kurs → Sinf → Vazifa → O'quvchi yechadi → AI baho → Dashboard

---

## Jamoa rollari

| Rol | Fayl | Texnologiyalar |
|---|---|---|
| Backend Developer | [01-backend.md](./01-backend.md) | Python 3.12, FastAPI, SQLAlchemy, PostgreSQL, Redis, Celery |
| Frontend Developer | [02-frontend.md](./02-frontend.md) | Next.js 14, TypeScript, Tailwind, shadcn/ui, Zustand |
| AI / Prompt Engineer | [03-ai-engineer.md](./03-ai-engineer.md) | Anthropic SDK, Pydantic, SSE, Redis cache |
| UI/UX + PM | [04-ui-pm.md](./04-ui-pm.md) | Figma, Framer Motion, demo tayyorlash |

---

## MVP / Post-MVP chegarasi

### MVP ga kiradi (2 kunda quriladi):
- [x] Login / Register (teacher + student)
- [x] AI bilan kurs generatsiyasi (SSE streaming)
- [x] Kurs + modul CRUD
- [x] Sinf yaratish + sinf kodi
- [x] AI yordamida vazifa generatsiyasi
- [x] MCQ + darhol AI izoh
- [x] Bo'shliq to'ldirish formati
- [x] Ochiq savol + AI baholash
- [x] Vaqtli musobaqa (taymer)
- [x] Streak tizimi + XP
- [x] O'qituvchi dashboard
- [x] Jonli URL (deploy: Vercel + Railway)

### Post-MVP (keyingi versiya):
- [ ] Drag-and-drop juftlashtirish (Matching)
- [ ] Tartibga solishtirish (Ordering)
- [ ] Real-time sinf reytingi (WebSocket)
- [ ] O'quvchi mustaqil kursi
- [ ] Video + savol formati
- [ ] Mobil ilova

---

## Vazifalar zanjiri (dependency map)

### DARHOL (Kun 1, 08:00) — BARCHA rollar parallel:
```
BE: Setup (repo, .env, DB, Redis)       ─┐
FE: Setup (Next.js, shadcn, Zustand)    ─┤  → barchasi bir vaqtda
AI: Setup (anthropic SDK, env check)    ─┤
PM: Figma file + dizayn tizimi          ─┘
```

### KETMA-KET (Backend → Frontend ni blok qiladi):
```
BE-P1: DB models + migration
    ↓
BE-P2: Auth endpoints (register/login/JWT/refresh)
    ↓
FE-P1: Login/Register sahifasi + auth context + route guard
    ↓
[parallel unlock: FE-P2 va BE-P3 bir vaqtda boshlanadi]
```

### PARALLEL (Kun 1, 11:00–17:00):
```
BE-P3: Course CRUD + Class CRUD          ─┐
FE-P2: Teacher dashboard + kurs forma   ─┤  parallel
AI-P1: Course generation prompt + SSE   ─┘

    ↓ (BE-P3 tayyor bo'lgandan keyin)

BE-P4: Assignment CRUD ──┐
AI-P1 tugagach:          ├── parallel
FE-P2 (AI streaming UI) ─┘
```

### KETMA-KET (AI backend → AI frontend):
```
AI-P1: /courses/ai-generate SSE endpoint tayyor
    ↓
FE: "AI bilan yarat" UI — SSE streaming ko'rsatish
```

### Kun 2 boshlanishi (KETMA-KET):
```
BE-P5: Submission endpoint + AI grading (MCQ + Ochiq)
    ↓
FE-P3: Vazifa yechish ekrani + XP animatsiyasi
    ↓ (parallel:)
BE-P6: Teacher dashboard API (sinf statistika)
FE-P3: MCQ + Vaqtli musobaqa komponentlari

    ↓
FE: Teacher dashboard grafiklari (Recharts)
```

### DOIM PARALLEL (ikki kun davomida):
```
PM: Dizayn tizimi + Figma komponentlar   (istalgan vaqtda)
AI: Prompt testing + tuning               (backenddan mustaqil)
PM: Demo stsenariysi tayyorlash           (Kun 2, 13:00+)
BE-P7: Security hardening (rate limit)   (Kun 2, 13:00+)
BE-P8: Docker + deploy                   (Kun 2, parallel)
```

---

## Kritik yo'l (Critical Path)

Quyidagi vazifalardan biri kechiksa — butun demo zanjiri to'xtaydi:

```
1. DB models (BE-P1)
2. Auth endpoints (BE-P2)
3. Login sahifasi (FE-P1)
4. AI kurs generatsiyasi endpoint (AI-P1 + BE-P3)
5. Submission + AI grading (BE-P5)
6. MCQ yechish ekrani (FE-P3)
7. Deploy (Vercel + Railway)
```

---

## Vazifalarni kuzatish uchun tavsiya

### GitHub Projects (tavsiya etiladi — bepul, repo ichida)

Yangi GitHub Project yarating: **"EduFlow Hackathon Board"**

**Columns (kanban):**
```
📋 Backlog  →  🔄 In Progress  →  👀 Review  →  ✅ Done
```

**Issue labels:**
```
# Rol bo'yicha:
backend        (ko'k)
frontend       (yashil)
ai-engineer    (binafsha)
ui-pm          (sariq)

# Muhimlik:
critical       (qizil)   — demo zanjiri uchun kerakli
nice-to-have   (kulrang)  — post-MVP

# Kun:
day-1          (to'q ko'k)
day-2          (to'q yashil)
```

**Har bir issue template:**
```markdown
## Vazifa: [BE/FE/AI/PM]-XX — Qisqa nomi

**Rol:** Backend / Frontend / AI / PM
**Kun:** 1 / 2
**Vaqt:** ~X soat
**Bog'liq vazifa:** #XX tayyor bo'lgandan keyin

### Bajariladigan ishlar:
- [ ] ...

### Muvaffaqiyat mezoni:
- ...
```

**Qo'shimcha vositalar:**

| Vosita | Afzalligi | Kamchiligi |
|---|---|---|
| **GitHub Projects** | Bepul, repo bilan integratsiya, issues bog'lash | UI unchalik qulay emas |
| **Linear** | Tez, keyboard-first, chiroyli UI | To'liq bepul emas (5 member limit) |
| **Notion** | Docs + tasks birlashgan | Sekin, offline ishlamaydi |
| **Trello** | Oddiy kanban | Issues bilan integratsiya yo'q |

> Hackathon uchun: **GitHub Projects** yoki **Linear** (kichik jamoa — bepul tier yetarli).

---

## Jadvalni ko'rish uchun:
- [Kun 1 jadvali →](./05-day1-schedule.md)
- [Kun 2 jadvali →](./06-day2-schedule.md)
