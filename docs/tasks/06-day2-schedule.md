# Kun 2 — Soatlik Jadval (O'quvchi tomoni + Polish)

> **Sana:** Hackathon 2-kuni | 08:00 – 18:00
> **Maqsad:** O'quvchi tomoni + to'liq demo zanjir + polish + deploy.

---

## Vizual jadval

```
08:00  09:00  10:00  11:00  12:00  13:00  14:00  15:00  16:00  17:00  18:00
  |      |      |      |      |      |      |      |      |      |      |
  [── Submission + AI grading ──][── Teacher Dashboard API ──][──Security──][── Deploy ──]
  BE:
  [── Student login + sinf ──][── MCQ solver + XP anim ──][──Timer──][──Polish──][──Final──]
  FE:
  [── Open/Timed prompts ──][── Grading funcs ──][────────── Redis cache + logs ──────────]
  AI:
  [─ Demo script ──────────────────────────][── Animatsiyalar ──][── QA ──][── Pitch ───]
  PM:
  |
  ⚑ CP4      |         ⚑ CP5              |     ⚑ CP6          |              ⚑ FINAL
```

**Checkpoints:**
- **⚑ CP4** `09:00` — Submission + grading ishlaydi
- **⚑ CP5** `12:00` — To'liq demo zanjiri ishlaydi (jonli saytda)
- **⚑ CP6** `15:00` — QA checklist o'tdi
- **⚑ FINAL** `17:00` — Deploy tayyor, demo mashq tugadi

---

## 08:00–10:00 — SUBMISSION + STUDENT SIDE

### Backend (BE-P5 tugatish, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 08:00–09:00 | `POST /assignments/{id}/submit` endpoint | BE-04-3 (tugatish) |
| 08:00–09:00 | MCQ avtomatik baholash (deterministik) | BE-04-5 |
| 09:00–10:00 | AI grading background task triggeri | BE-05-4 |
| 09:00–10:00 | XP + streak update logikasi | BE-06-1 |

### Frontend (FE-P3 boshlash, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 08:00–09:00 | Student Dashboard (E-09): XP ring, streak, faol kurslar | FE-09-1 |
| 08:30–09:30 | Sinf kodi kiritish UI (Dashboard da) | FE-09-1 (davom) |
| 09:00–10:00 | Kurs mazmuni sahifasi (E-10): modullar + progress bar | FE-10-1 |

### AI Engineer (AI-P3 boshlash, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 08:00–09:00 | Baholash system prompt + user prompt template | AI-03-1,2 |
| 09:00–10:00 | `GradeResult` Pydantic sxema + `grade_answer()` funksiya | AI-03-3,4 |

### PM (Demo script boshlanishi, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 08:00–09:30 | Kun 1 dan qolgan Figma ekranlarini tugatish | PM-01 (davom) |
| 09:30–10:00 | Demo seed data script yozish (teacher@demo.uz, student@demo.uz) | PM-03-2 |

### ⚑ CP4 (09:00-09:30) — Submission tekshiruvi:
- [ ] O'quvchi MCQ javobi yuboradi → natija saqlanadi
- [ ] XP qo'shiladi → student dashboard yangilanadi
- [ ] AI grading background da boshlanadi (MCQ uchun deterministik)

---

## 10:00–12:00 — TEACHER DASHBOARD API + VAZIFA YECHISH UI

### Backend (BE-P6, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 10:00–11:00 | `GET /dashboard/teacher` — sinf statistika, pending reviews | BE-06-2 |
| 10:00–11:00 | `GET /dashboard/student` — XP, level, streak, kurslar | BE-06-3 |
| 11:00–12:00 | `GET /assignments/{id}/results` (teacher: hamma, student: o'zi) | BE-06-4 |
| 11:00–12:00 | Achievement trigger: streak 3/7/30 kun | BE-06-5 |
| 11:00–12:00 | `POST /submissions/{id}/confirm` — teacher AI ballini tasdiqlaydi | BE-04-3 |

### Frontend (FE-P3 davom, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 10:00–11:00 | `MCQSolver.tsx` — 4 ta variant karta + to'g'ri/noto'g'ri animatsiya | FE-11-2 |
| 10:30–11:30 | AI izoh skeleton loader → matn | FE-04-S2 (qisman) |
| 11:00–12:00 | `XPAnimation.tsx` — "+30 XP" float animatsiya (Framer Motion) | PM-02-1 bilan birgalikda |
| 11:00–12:00 | Natija ekrani (E-12): ball + izoh + XP | FE-12-1 |

### AI Engineer (AI-P3 davom + AI-P2 tugatish, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 10:00–11:00 | Fill-in-blank semantik tekshiruv (Claude bilan) | AI-03-5 |
| 10:00–11:00 | Open answer prompt test: "Fotosintez" savoli | AI-03-6 |
| 11:00–12:00 | Matching + Ordering prompts (vaqt bo'lsa) | AI-02-3,4 |

### PM + Frontend (Animatsiyalar, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 10:00–11:00 | MCQ to'g'ri/noto'g'ri animatsiya spec → kod | PM-02-4 |
| 11:00–12:00 | AI streaming kursor animatsiya | PM-02-5 |

---

## 12:00–13:00 — CHECKPOINT 5: TO'LIQ DEMO ZANJIR

> **BARCHA rollar birgalikda.** Bu eng muhim tekshiruv.

### Demo zanjirni to'liq o'ynash (jonli saytda):

| # | Kim | Harakat | Kutilayotgan natija |
|---|---|---|---|
| 1 | O'qituvchi | Login → Dashboard | Dashboard ko'rinadi |
| 2 | O'qituvchi | "AI bilan kurs yarat" → "Matematika 8-sinf" | SSE streaming ko'rinadi |
| 3 | O'qituvchi | Kurs tahriri → Chop etish | Published status |
| 4 | O'qituvchi | Sinf yaratish → sinf kodi | 6 belgili kod |
| 5 | O'qituvchi | AI bilan MCQ vazifa → Chop etish | Sinfga biriktirildi |
| 6 | O'quvchi | Boshqa oynada: Register → Sinf kodi | Kurslarga kirdi |
| 7 | O'quvchi | Vazifani boshlash → MCQ javob | AI izoh + XP animatsiya |
| 8 | O'quvchi | Ochiq savol → Matn yozish → Yuborish | AI baho: XX/100 |
| 9 | O'qituvchi | Dashboard → Natijalar | O'quvchi natijasi ko'rinadi |
| 10 | O'qituvchi | Tasdiqlash navbati | AI ballni tasdiqlash |

### Topilgan buglar → tezkor hal:
- P0 (blocker): HOZIR tuzatish
- P1 (muhim): 13:00–15:00 da tuzatish
- P2 (kosmetik): 15:00–17:00 da tuzatish yoki qoldirish

---

## 13:00–15:00 — POLISH + SECURITY + VAQTLI MUSOBAQA

### Backend (BE-P7, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 13:00–13:30 | `slowapi` rate limiting | BE-07-1 |
| 13:30–14:00 | CORS + security headers middleware | BE-07-2,3 |
| 14:00–14:30 | HTTPS redirect + ENV validation startup | BE-07-4,5 |
| 14:30–15:00 | CP5 da topilgan backend buglarni tuzatish | — |

### Frontend (FE-P3 + FE-P4, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 13:00–14:00 | `TimedQuizSolver.tsx` — taymer + rangli progress | FE-11-4 |
| 13:00–14:00 | `FillSolver.tsx` — inline input maydonlar | FE-11-3 |
| 14:00–14:30 | `OpenAnswerSolver.tsx` — textarea + harf sanagich | FE-11-5 |
| 14:30–15:00 | Teacher dashboard grafiklari (Recharts) | FE-07-1 |

### AI Engineer (AI-P4, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 13:00–14:00 | Redis kesh wrapper + TTL 1 soat | AI-04-1 |
| 14:00–15:00 | `ai_logs` DB insert + Celery task wrapper | AI-04-2,3 |

### PM (Demo + Animatsiyalar, ~2 soat):
| Vaqt | Vazifa | ID |
|---|---|---|
| 13:00–14:00 | Demo stsenariysi hujjatini yakunlash | PM-03-1 |
| 14:00–14:30 | Streak animatsiyasi + daraja oshishi modali | PM-02-2,3 |
| 14:30–15:00 | Page transitions | PM-02-6 |

---

## 15:00–17:00 — QA + FINAL POLISH + PITCH

### 15:00–16:00 — QA Checklist (PM koordinatsiya, barcha qatnashadi):

**Funksional testlar:**
- [ ] Login teacher + student
- [ ] AI kurs generatsiya SSE streaming
- [ ] Sinf kodi → o'quvchi ulanishi
- [ ] MCQ + to'g'ri AI izoh
- [ ] Ochiq savol + AI baho + teacher tasdiqlash
- [ ] Vaqtli musobaqa taymer
- [ ] XP animatsiya
- [ ] Teacher dashboard statistika

**Vizual testlar:**
- [ ] Dark mode toggle
- [ ] Mobile 375px (Chrome DevTools)
- [ ] Skeleton loaders barcha AI so'rovlarda
- [ ] Toast xabarlar

**Deploy testlar:**
- [ ] Vercel URL ochiq, HTTPS ✓
- [ ] Railway API URL ochiq, HTTPS ✓
- [ ] `.env.production` barcha ENV lar to'g'ri

### 16:00–17:00 — PITCH + ZAXIRA:
| Vaqt | Vazifa | ID |
|---|---|---|
| 16:00–16:30 | Pitch slide deck yakunlash (5-7 slayd) | PM-03-4 |
| 16:00–16:30 | Hakamlar javoblari mashqi | PM-03-5 |
| 16:30–17:00 | Screenshot lar + Loom recording (zaxira) | PM-03-3 |

---

## 17:00–18:00 — FINAL DEPLOY + DEMO MASHQI

| Vaqt | Vazifa |
|---|---|
| 17:00–17:15 | Final deploy: Vercel + Railway production |
| 17:15–17:30 | Seed data: demo foydalanuvchilar tayyor |
| 17:30–18:00 | **To'liq demo mashqi** (barcha jamoa, 5 daqiqa, soat o'lchab) |

### ⚑ FINAL (17:45) — Tayyor ekanlik tekshiruvi:
- [ ] Jonli saytda to'liq demo zanjiri 5 daqiqada ishlaydi
- [ ] Zaxira screenshot lar mavjud
- [ ] Pitch deck tayyor
- [ ] Hakamlar savollari tayyorlandi
- [ ] Barcha jamoa a'zolari demo stsenariyini biladi

---

## Kun 2 Xatarlarini Boshqarish

| Xatar | Ehtimol | Yechim |
|---|---|---|
| AI grading sekin (>10s) | O'rta | SSE streaming bilan "tekshirilmoqda..." ko'rsating |
| Demo paytida internet uzilishi | Past | Localhost da ham tayyor bo'lsin, zaxira recording |
| Vaqt yetmasligi | Yuqori | Matching/Ordering ni qoldiring, MCQ+Open+Timed kifoya |
| Frontend animatsiya laggi | Past | Framer Motion `will-change: transform` |
| Teacher dashboard grafik xatosi | O'rta | Recharts o'rniga oddiy jadval ham qabul qilinadi |

---

## MVP Muvaffaqiyat Mezoni

Kun 2 oxirida quyidagilar ishlashi **shart**:

```
✅ Login (teacher + student)
✅ AI kurs generatsiyasi — SSE streaming
✅ Sinf yaratish + sinf kodi
✅ MCQ vazifa + darhol AI izoh
✅ Ochiq savol + AI baho (teacher tasdiqlaydi)
✅ Vaqtli musobaqa taymer
✅ XP + streak tizimi
✅ Teacher dashboard
✅ Jonli URL (deploy)
```

```
⏸ Keyingi versiyaga:
   Matching (drag-and-drop)
   Ordering (drag-and-drop)
   Real-time leaderboard (WebSocket)
```
