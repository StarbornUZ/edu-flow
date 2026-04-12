# EduFlow — Loyiha Arxitekturasi va Fazalar Xaritasi
> **TZ v3.0 · National AI Hackathon · Buxoro 2026**
> Stack: FastAPI + Next.js 14 + PostgreSQL + Claude API + WebSocket

---

## Loyiha haqida

**EduFlow** — xususiy maktablar va o'quv markazlari uchun B2B SaaS ta'lim platformasi.

```
Tashkilot yaratish so'rovi
  → Admin tasdiqlaydi
    → Organization-admin: o'qituvchi + sinf + o'quvchi qo'shadi
      → Teacher: AI bilan kurs yaratadi, musobaqa o'tkazadi
        → Student: mavzu o'rganadi, vazifa bajaradi → XP oladi
          → Parent: farzandning progressini kuzatadi
```

**Demo zanjiri (5 daqiqa):**
```
Admin: Org so'rovni tasdiqlash (10 sek)
→ Org-admin: sinf + teacher + student yaratish (30 sek)
→ Teacher: AI bilan kurs generatsiyasi (30 sek)
→ Student: mavzu o'qiydi + vazifa bajaradi (40 sek)
→ AI: javobni baholaydi + XP beradi (5 sek)
→ Teacher: Blitz Jang boshlaydi → real-time leaderboard
→ Dashboard: to'liq statistika
```

---

## Foydalanuvchi rollari

| Rol | Daraja | Asosiy qobiliyatlar |
|-----|--------|---------------------|
| `admin` | Platform | So'rovlar, fanlar, platform sozlamalari |
| `org_admin` | Tashkilot | O'qituvchi/sinf/o'quvchi/ota-ona boshqaruvi |
| `teacher` | Sinf/Kurs | Kurs (AI), musobaqa, baholash, dashboard |
| `student` | Shaxsiy | Mavzular, vazifalar, XP, musobaqa |
| `parent` | Kuzatuv | Farzand statistikasi, PDF hisobot |

---

## Jamoa va Fazalar Taqsimoti

| Kishi | Rol | Asosiy fazalar |
|-------|-----|----------------|
| **Akramov Oybek** | TeamLead | Koordinatsiya, Faza 4 (AI), Faza 5 (Live), Faza 7 (Deploy) |
| **Muxtorov Javohirbek** | Backend | Faza 1 (Foundation), Faza 2 (Org), Faza 3 (Academic) |
| **Amonov Ahmadjon** | Frontend/AI | Faza 6A: Admin + Teacher UI, AI generatsiya UI |
| **Amonov Aminjon** | Frontend/UX | Faza 6B: Student + Parent UI, Live musobaqa UI |

---

## Fazalar Xaritasi

| # | Faza | Mas'ul | Kun/Vaqt | Fayl |
|---|------|--------|----------|------|
| **0** | Setup — barcha toollar | Barchasi | Kun 1 · 08-09 | — |
| **1** | Foundation: DB Schema + Auth | Javohir | Kun 1 · 09-11 | [01-phase1](./01-phase1-foundation.md) |
| **2** | Organization flow | Javohir | Kun 1 · 11-13 | [02-phase2](./02-phase2-organization.md) |
| **3** | Academic core | Javohir | Kun 1 · 13-17 | [03-phase3](./03-phase3-academic.md) |
| **4** | AI integration | Oybek + Javohir | Kun 1 · 14-19 | [04-phase4](./04-phase4-ai.md) |
| **5** | Live sessions (WebSocket) | Oybek + Aminjon | Kun 2 · 08-12 | [05-phase5](./05-phase5-live.md) |
| **6** | Frontend | Ahmadjon + Aminjon | Kun 1-2 parallel | [06-phase6](./06-phase6-frontend.md) |
| **7** | Deploy + Xavfsizlik | Oybek | Kun 2 · 15-18 | [07-phase7](./07-phase7-deploy.md) |

---

## Parallel ishlash grafigi

```
Kun 1:
08:00 ┌── Barchasi: Faza 0 (Setup) ───────────────────────────────────┐
09:00 ├── Javohir: Faza 1 (DB+Auth) ─────────┐                        │
      │   Ahmadjon+Aminjon: FE Setup ─────────────────────────────────┤
11:00 ├── Javohir: Faza 2 (Org) ─────────────┘                        │
      │   Ahmadjon: FE Login + Admin UI ──────────────────────────────┤
13:00 ├── Javohir: Faza 3 (Academic) ────────────────────────┐         │
      │   Oybek: Faza 4 (AI) parallel boshlanadi ────────────┤         │
      │   Aminjon: FE Student UI ──────────────────────────────────────┤
17:00 ├── Javohir: Faza 3 tugaydi                            │         │
19:00 └── Oybek: Faza 4 tugaydi ────────────────────────────┘         │

Kun 2:
08:00 ┌── Oybek+Aminjon: Faza 5 (Live WS) ─────────────────────┐      │
      │   Ahmadjon: Dashboard + AI UI ─────────────────────────┤      │
12:00 ├── Faza 5 tugaydi                                        │      │
      │   FE polish + integration ──────────────────────────────┤      │
15:00 ├── Oybek: Faza 7 (Deploy) ──────────────────────────────┘      │
18:00 └── Deploy tayyor → Demo rehearsal ────────────────────────────────┘
```

---

## Kritik yo'l

```
Faza 1 → Faza 2 → Faza 3 → Faza 4
                            ↓
                     Faza 6 (Teacher UI + Student UI)
                            ↓
                      Faza 7 (Deploy)
```

> Faza 5 (Live) — MVP demo uchun **kerakli**, lekin vaqt yetmasa Blitz Jang (sodda tur) bilan cheklanish mumkin.

---

## Mavjud kod holati

```
✅ Mavjud (o'zgartirish kerak):
├── backend/db/models/user.py         role: teacher/student/admin → + org_admin, parent
├── backend/db/models/course.py       Course+Module+Enrollment  → + org_id, topic_id
├── backend/db/models/class_.py       Class+ClassEnrollment     → + org_id, subject_id
├── backend/db/models/assignment.py   Assignment+Question       → + topic_id link
├── backend/db/models/submission.py   Submission+Result+Achievement
├── backend/api/routes/auth.py        register/login/me
├── backend/api/routes/courses.py     CRUD
├── backend/api/routes/classes.py     CRUD + join
├── backend/api/routes/assignments.py
├── backend/api/routes/ai.py          generate + grade
├── backend/api/routes/dashboard.py   teacher + student
├── backend/services/ai_service.py    Claude wrapper
└── backend/services/gamification_service.py

❌ Yo'q (yaratish kerak):
├── backend/db/models/organization.py    Organization + Request + Member
├── backend/db/models/subject.py         Subject (global/org)
├── backend/db/models/topic.py           Topic (Module → Topic → Assignment)
├── backend/db/models/live_session.py    LiveSession + Team + Participant + Question
├── backend/db/models/badge.py           Badge + StudentBadge
├── backend/db/models/parent_student.py  ParentStudent
├── backend/api/routes/organizations.py  Org CRUD + request flow
├── backend/api/routes/topics.py         Topic CRUD
├── backend/api/routes/live_sessions.py  WS musobaqa
├── backend/services/live_session_service.py
└── frontend/  (butun papka)
```
