# Kun 1 — Soatlik Jadval (O'qituvchi tomoni)

> **Sana:** Hackathon 1-kuni | 08:00 – 22:00
> **Maqsad:** O'qituvchi tomoni to'liq ishlashi — login, kurs yaratish (AI), sinf, vazifa.

---

## Vizual jadval

```
08:00  09:00  10:00  11:00  12:00  13:00  14:00  15:00  16:00  17:00  18:00  19:00  20:00  21:00  22:00
  |      |      |      |      |      |      |      |      |      |      |      |      |      |      |
  [──────── SETUP (barcha) ────]
  |                             [──── DB Models ────][──── Auth Routes ────]
  BE:                           [──── DB Models ────][──── Auth Endpoints ──][── Course/Class CRUD ──][── Assign CRUD ──][────── Integratsiya ──────]
  |                             [── Auth Routes ──]
  |                                                  [────── Teacher Dashboard Skeleton ─────][── Vazifa UI ──][────── Integratsiya ──────]
  FE:                           [── Login/Register ──][────── Teacher Dashboard ──────────────][─ Vazifa UI ──][────── Integratsiya ──────]
  |
  AI:   [─ Setup ─]             [──────────────────────── Kurs gen prompt + SSE ──────────────][── Vazifa gen ──][────── Integratsiya ──────]
  PM:   [─ Figma ─────────────────────────────────────────────────────────────────────────────────][─ QA ────────────────────────────────]
  |
  |   ⚑ CP0      |          ⚑ CP1               |          ⚑ CP2           |             ⚑ CP3
```

**Checkpoints:**
- **⚑ CP0** `09:00` — Setup tayyor, env ishlaydi
- **⚑ CP1** `11:00` — DB + login ishlaydi
- **⚑ CP2** `13:00` — Login → Kurs → Sinf zanjiri ishlaydi
- **⚑ CP3** `19:00` — Kun 1 to'liq demo zanjiri ishlaydi

---

## 08:00–09:00 — SETUP (Barcha rollar, parallel)

### Barcha bir vaqtda:
| Rol | Vazifa |
|---|---|
| **Jamoa** | Git repo clone, branch strategiyasi kelishish |
| **Backend** | `uv sync`, `.env` to'ldirish, DB + Redis ulanish test |
| **Frontend** | `npx create-next-app@14 frontend`, shadcn/ui init, kutubxonalar install |
| **AI** | `anthropic` SDK test, API key tekshirish, `ai_client.py` skeleton |
| **PM** | Figma fayl yaratish, rang palitasi, GitHub Projects board sozlash |

### ⚑ CP0 (09:00) — Tekshirish:
- [ ] `GET /health` → `{"status": "ok"}`
- [ ] DB + Redis ulanadi
- [ ] `npm run dev` → `localhost:3000` ochiladi
- [ ] Claude API ping ishlaydi

---

## 09:00–11:00 — DB MODELS + AUTH (Backend), LOGIN (Frontend)

### Backend (BE-P1, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 09:00–10:00 | `users`, `courses`, `course_modules` modellari | BE-01-1,2 |
| 09:30–10:30 | `classes`, `class_enrollments`, `assignment`, `question` modellari | BE-01-3,4 |
| 10:00–10:30 | `submission`, `submission_result`, `user_progress`, `achievement`, `ai_logs` | BE-01-5 |
| 10:30–11:00 | Alembic migration + `db/base.py` + `deps.py` | BE-01-6,7,8,9 |

### Frontend (FE-P0 davom, FE-P1, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 09:00–09:30 | Papka strukturasi + `lib/api.ts` axios instance | FE-00-4,5 |
| 09:30–10:00 | `auth.store.ts` Zustand + `middleware.ts` | FE-00-6,7 |
| 10:00–10:30 | `types/index.ts` TypeScript interfeyslari | FE-00-8 |
| 10:30–11:00 | Login + Register sahifasi (forma, validatsiya) | FE-01-1,2 |

### AI Engineer (AI-P0 davom, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 09:00–10:00 | `stream_claude()` async generator + test | AI-00-3,5 |
| 10:00–11:00 | `get_json_response()` retry wrapper | AI-00-4 |

### PM (Figma davom, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 09:00–10:00 | Figma komponentlar: Button, Card, Input, Badge | PM-00-4 |
| 10:00–11:00 | Teacher dashboard wireframe (E-02) | PM-01-1 |

### ⚑ CP1 (11:00) — Tekshirish:
- [ ] `POST /auth/register` → 201 OK + tokenlar
- [ ] `POST /auth/login` → JWT tokenlar
- [ ] Login sahifasi formasi ishlaydi (frontend-backend ulanadi)

---

## 11:00–13:00 — KURS/SINF CRUD (Backend), TEACHER DASHBOARD (Frontend)

### Backend (BE-P2 tugatish + BE-P3, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 11:00–11:30 | Auth endpoints tugatish: `GET /auth/me`, token blacklist | BE-02-3,4,5 |
| 11:30–12:30 | Course CRUD endpoints (7 ta route) | BE-03-1,2,3 |
| 12:30–13:00 | Class CRUD + sinf kodi generatsiya | BE-03-4,5,6 |

### Frontend (FE-P2 boshlash, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 11:00–11:30 | `AuthProvider.tsx` + token refresh logikasi | FE-01-3,4 |
| 11:30–12:30 | Teacher Dashboard (E-02) — kurs kartochkalar + sinf ro'yxat | FE-02-1,2 |
| 12:30–13:00 | "Kurs yaratish" formasi — qo'lda tab (E-03) | FE-03-1 |

### AI Engineer (AI-P1 boshlash, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 11:00–12:00 | Kurs generatsiyasi system prompt + user prompt template | AI-01-1,2 |
| 12:00–13:00 | `CourseGenerationResponse` Pydantic sxema | AI-01-3 |

### PM (~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 11:00–12:00 | Kurs yaratish wireframe (E-03): AI streaming panel | PM-01-2 |
| 12:00–13:00 | Format picker dizayni (E-05) — 6 ta format karta | PM-01-3 |

### ⚑ CP2 (13:00) — Demo zanjir tekshiruvi:
```
O'qituvchi login qiladi → Dashboard ko'radi → Kurs yaratadi → Sinf yaratadi
```
- [ ] `POST /courses` → kurs saqlanadi
- [ ] `POST /classes` → sinf kodi avtomatik
- [ ] Teacher dashboard kurslarni ko'rsatadi
- [ ] Blokerlar aniqlangan → Kun 2 jadvaliga kiritiladi

---

## 13:00–14:00 — TUSHLIK VA REPLANIROVA

| Harakat | Mas'ul |
|---|---|
| CP2 natijalarini ko'rib chiqish | PM |
| Blokerlarni aniqlash va hal qilish | Jamoa |
| Kun 2 prioritetlarini yangilash | PM |
| Har kim keyingi 4 soat uchun aniq vazifalarini biladi | PM |

---

## 14:00–17:00 — AI KURS GENERATSIYASI (AI+Backend), UI POLISH (Frontend+PM)

### Backend + AI (parallel, ~3 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 14:00–15:00 | `ai_service.py`: `stream_course_generation()` | AI-01-4 + BE-05-1 |
| 14:00–15:00 | SSE streaming endpoint `POST /courses/ai-generate` | BE-05-2,3 |
| 15:00–16:00 | JSON parser + DB saqlash logikasi | AI-01-5 |
| 15:00–16:00 | `ai_logs` insert funksiyasi | BE-05-5 |
| 16:00–17:00 | Test: "Matematika, 8-sinf, Algebra" → kurs generatsiya | AI-01-6 |
| 16:00–17:00 | Prompt injection sanitizatsiya | BE-05-7 |

### Frontend (FE-P2 davom, ~3 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 14:00–15:30 | `AIStreamingView.tsx` — EventSource + token-token matn | FE-03-2 |
| 15:30–16:30 | Kurs tahriri (E-04) — modullar list + drag reorder | FE-04-1 |
| 16:30–17:00 | Sinf boshqaruvi sahifasi (E-06) skeleton | FE-06-1 |

### PM (~3 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 14:00–15:00 | Student Dashboard wireframe (E-09): XP ring + streak | PM-01-5 |
| 15:00–16:00 | MCQ karta dizayni (E-11): to'g'ri/noto'g'ri holatlari | PM-01-6 |
| 16:00–17:00 | Vaqtli musobaqa timer dizayni (E-13): rang progressi | PM-01-7 |

---

## 17:00–19:00 — VAZIFA CRUD (Backend), VAZIFA UI (Frontend)

### Backend (BE-P4, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 17:00–18:00 | Assignment CRUD: create, get, list | BE-04-1,2,3 |
| 17:00–18:30 | MCQ va Ochiq savol uchun Pydantic sxemalar | BE-04-1 |
| 18:00–19:00 | Submission save + attempt hisoblash | BE-04-4 |
| 18:00–19:00 | AI vazifa generatsiyasi endpoint | BE-05-2 |

### AI Engineer (AI-P2 boshlash, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 17:00–18:00 | MCQ prompt + `MCQGenerationResponse` sxema | AI-02-1 |
| 18:00–19:00 | Fill-in-blank prompt + sxema | AI-02-2 |

### Frontend (FE-P2 davom, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 17:00–18:00 | Vazifa yaratish sahifasi (E-05) — format picker | FE-05-1 |
| 18:00–19:00 | `MCQQuestionBuilder.tsx` + `OpenQuestionBuilder.tsx` | FE-05-2 |

---

## 19:00–22:00 — INTEGRATSIYA + DEPLOY + BUG FIX

> Barcha rollar birgalikda. **Bitta kompyuterda** yoki Discord screen share da.

| Vaqt | Vazifa |
|---|---|
| 19:00–20:00 | Kun 1 to'liq integratsiya: Login → AI kurs → Sinf → Vazifa |
| 19:00–20:00 | Topilgan buglarni tezkor tuzatish |
| 20:00–21:00 | **Deploy:** Railway (backend) + Vercel (frontend) |
| 20:00–21:00 | ENV variables production da tekshirish |
| 21:00–21:30 | Jonli URLda demo zanjirni sinov |
| 21:30–22:00 | Kun 2 rejasini yakunlash, har kim navbatdagi vazifalarini biladi |

### ⚑ CP3 (21:00) — Kun 1 yakuniy tekshiruv:
```
Jonli saytda: O'qituvchi login → AI kurs generatsiya → Sinf yaratish → Vazifa chop etish
```
- [ ] SSE streaming jonli saytda ishlaydi
- [ ] Sinf kodi generatsiya ishlaydi
- [ ] MCQ vazifa saqlanadi
- [ ] Railway va Vercel URL lar ochiq

---

## Kun 1 Xatarlarini Boshqarish

| Xatar | Ehtimol | Yechim |
|---|---|---|
| DB migration xatosi | O'rta | Alembic `--sql` flag bilan SQL ni ko'rib chiqing |
| Claude API limit | Past | ANTHROPIC_API_KEY to'g'rimi tekshiring; zaxira: GPT-4o |
| Railway deploy xatosi | O'rta | Avval Docker local da test qiling |
| Frontend-Backend CORS | Yuqori | `.env` da `FRONTEND_URL` to'g'ri belgilang |
| SSE streaming ishlamaydi | O'rta | FastAPI `StreamingResponse` va `text/event-stream` content-type |
