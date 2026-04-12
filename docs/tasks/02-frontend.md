# Frontend Developer — Vazifalar ro'yxati

**Rol:** Frontend Developer
**Texnologiyalar:** Next.js 14 (App Router), TypeScript, Tailwind CSS v3, shadcn/ui, Zustand, TanStack Query v5, React Hook Form + Zod, Framer Motion, Recharts
**Deploy:** Vercel

> Qaramlik: FE-P1 (Login) — BE-P2 (auth endpoints) tayyor bo'lgandan keyin boshlanadi.

---

## Phase 0 — Setup `[DARHOL, ~1 soat, Kun 1 08:00–09:00]`

> Backend bilan **parallel** bajarish mumkin.

- [ ] **FE-00-1** — Next.js 14 proyektini `/frontend` papkasida yaratish:
  ```bash
  npx create-next-app@14 frontend --typescript --tailwind --app --src-dir --import-alias "@/*"
  ```
- [ ] **FE-00-2** — shadcn/ui init:
  ```bash
  cd frontend && npx shadcn@latest init
  # Kerakli komponentlarni qo'shish: button, card, input, dialog, tabs,
  # progress, badge, avatar, skeleton, toast, dropdown-menu
  ```
- [ ] **FE-00-3** — Qo'shimcha kutubxonalarni o'rnatish:
  ```bash
  npm install zustand @tanstack/react-query react-hook-form zod @hookform/resolvers
  npm install framer-motion recharts lucide-react @dnd-kit/core @dnd-kit/sortable
  npm install axios
  ```
- [ ] **FE-00-4** — Papka strukturasini yaratish:
  ```
  src/
  ├── app/
  │   ├── (auth)/login/   ← E-01
  │   ├── (auth)/register/
  │   ├── teacher/        ← E-02 to E-08
  │   └── student/        ← E-09 to E-15
  ├── components/
  │   ├── ui/             (shadcn — avtomatik)
  │   ├── teacher/
  │   ├── student/
  │   └── shared/
  ├── lib/
  │   ├── api.ts          (axios instance)
  │   ├── auth.ts         (token management)
  │   └── utils.ts
  ├── stores/
  │   └── auth.store.ts   (Zustand)
  └── types/
      └── index.ts
  ```
- [ ] **FE-00-5** — `src/lib/api.ts`: axios instance + interceptor
  ```typescript
  // baseURL: process.env.NEXT_PUBLIC_API_URL
  // Request interceptor: Authorization: Bearer {accessToken}
  // Response interceptor: 401 → refresh token → retry
  ```
- [ ] **FE-00-6** — `src/stores/auth.store.ts`: Zustand store
  ```typescript
  // { user, accessToken, setUser, setTokens, logout }
  ```
- [ ] **FE-00-7** — `src/middleware.ts`: route protection
  ```typescript
  // /teacher/* → role === 'teacher' kerak
  // /student/* → role === 'student' kerak
  // token yo'q → /login ga redirect
  ```
- [ ] **FE-00-8** — `src/types/index.ts`: barcha TypeScript interfeyslari
  ```typescript
  // User, Course, CourseModule, Class, Assignment, Question,
  // Submission, SubmissionResult, XPAction, Achievement
  ```
- [ ] **FE-00-9** — `.env.local`:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
  ```

**Muvaffaqiyat:** `npm run dev` → `localhost:3000` ochiladi, xatosiz.

---

## Phase 1 — Auth Screens `[KETMA-KET, ~1.5 soat, Kun 1 11:00–12:30]`

> BE-P2 (auth endpoints) tayyor bo'lgandan keyin boshlanadi. Bu faza **FE-P2 uchun bloklovchi**.

- [ ] **FE-01-1** — `src/app/(auth)/login/page.tsx` — **E-01 Login**:
  ```
  - Email + parol inputlari (React Hook Form + Zod validatsiya)
  - "Kirish" tugmasi → POST /auth/login
  - Xato holatlari: "Email yoki parol noto'g'ri"
  - "Ro'yxatdan o'tish" havolasi
  ```
- [ ] **FE-01-2** — `src/app/(auth)/register/page.tsx` — **E-01 Register**:
  ```
  - Ism, email, parol, rol (Teacher / Student toggle)
  - → POST /auth/register
  - Rol tanlash: radio buttons yoki toggle (chiroyli UI)
  ```
- [ ] **FE-01-3** — `src/components/shared/AuthProvider.tsx`:
  ```typescript
  // Sahifa yuklanishida localStorage dan token oladi
  // GET /auth/me → user ma'lumotlari oladi
  // Context orqali butun app ga tarqatadi
  ```
- [ ] **FE-01-4** — Token yangilash logikasi: refresh token bilan avtomatik `access_token` yangilash

**Muvaffaqiyat:** Login → Dashboard ga redirect bo'ladi. Token localStorage da saqlanadi. Refresh token HttpOnly cookie da.

---

## Phase 2 — Teacher Side `[PARALLEL BE-P3 bilan, Kun 1 11:00–19:00]`

> Auth (FE-P1) tayyor bo'lgandan keyin boshlanadi. BE-P3 endpointlari bilan parallel.

### E-02 — Teacher Dashboard
- [ ] **FE-02-1** — `src/app/teacher/page.tsx`:
  ```
  - Kurslar kartochkalari (grid, draft/published badge)
  - Sinflar ro'yxati + o'quvchilar soni
  - "Kutayotgan tekshiruvlar" widget (ochiq savol AI balllar)
  - Faollik grafigi (Recharts — keyingi fazada)
  - "+ Kurs yaratish" va "+ Sinf yaratish" tugmalar
  ```
- [ ] **FE-02-2** — `src/components/teacher/CourseCard.tsx` + `ClassCard.tsx`

### E-03 — Kurs Yaratish
- [ ] **FE-03-1** — `src/app/teacher/courses/new/page.tsx`:
  ```
  - Tabs: "Qo'lda" | "AI bilan yarat"
  - Qo'lda: Fan, nomi, tavsif, qiyinlik, qopqoq rasm
  - AI mode: Fan + maqsad inputlari → "Yaratish" tugma
  ```
- [ ] **FE-03-2** — `src/components/teacher/AIStreamingView.tsx`:
  ```typescript
  // EventSource API bilan SSE streaming
  // Token-token matn ko'rinadi (yashil kursor animatsiyasi)
  // useEffect → new EventSource(url) → onmessage → setContent
  ```

### E-04 — Kurs Tahriri
- [ ] **FE-04-1** — `src/app/teacher/courses/[id]/edit/page.tsx`:
  ```
  - Modullar ro'yxati (drag-and-drop tartib o'zgartirish: @dnd-kit/sortable)
  - Har modul: WYSIWYG editor (react-md-editor yoki simple textarea)
  - Modul qo'shish / o'chirish tugmalar
  - "Chop etish" tugmasi → PATCH /courses/{id}/publish
  ```

### E-05 — Vazifa Yaratish
- [ ] **FE-05-1** — `src/app/teacher/assignments/new/page.tsx`:
  ```
  - Format tanlash: 6 ta tab yoki dropdown (MCQ / Fill / Matching / ...)
  - Savol qo'shish formasi (formatga qarab o'zgaradi)
  - "AI bilan yarat" tugma → SSE streaming
  - Preview tab (o'quvchi ko'rinishini preview qilish)
  - Deadline + vaqt limiti sozlamalari
  ```
- [ ] **FE-05-2** — Savol komponentlari (har format uchun):
  ```
  MCQQuestionBuilder.tsx     — 4 ta option input, to'g'ri javob radio
  FillQuestionBuilder.tsx    — Matn + ___ joy belgilash UI
  TimedQuizBuilder.tsx       — Vaqt limiti slider (30/60/90 soniya)
  OpenQuestionBuilder.tsx    — Matn area + rubrika yaratish
  ```

### E-06 — Sinf Boshqaruvi
- [ ] **FE-06-1** — `src/app/teacher/classes/[id]/page.tsx`:
  ```
  - O'quvchilar jadvali (ism, email, XP, faollik)
  - Sinf kodi (katta, nusxalanadigan, share button)
  - Biriktirilgan kurslar + deadline lar
  - "O'quvchi qo'shish" → kurs biriktirish modal
  ```

### E-07 — Natijalar Dashboard
- [ ] **FE-07-1** — `src/app/teacher/classes/[id]/results/page.tsx`:
  ```
  - Recharts BarChart: har o'quvchi XP
  - LineChart: vaqt o'tishi bo'yicha progress
  - "Muammoli savollar" card (xato ko'p berilgan savollar)
  - O'quvchi bo'yicha filter
  ```

### E-08 — Tasdiqlash Navbati
- [ ] **FE-08-1** — `src/app/teacher/reviews/page.tsx`:
  ```
  - Ochiq savol submission lari ro'yxati
  - Har biri: o'quvchi javobi + AI ball + AI izoh
  - "Tasdiqlash" | "O'zgartirish" tugmalar
  - Ball o'zgartirilsa: number input + izoh qo'shish
  ```

**Muvaffaqiyat:** O'qituvchi login → dashboard → kurs yaratish (AI bilan) → sinf yaratish → vazifa yaratish zanjiri ishlaydi.

---

## Phase 3 — Student Side `[Kun 2 08:00–12:00]`

> BE-P5 (submission + AI grading) tayyor bo'lgandan keyin boshlanadi.

### E-09 — Student Dashboard
- [ ] **FE-09-1** — `src/app/student/page.tsx`:
  ```
  - XP ring (circular progress, Framer Motion animatsiya)
  - Streak olov 🔥 (kunlik ketma-ketlik soni, pulse animatsiya)
  - Faol kurslar ro'yxati (progress bar lar bilan)
  - Yutuqlar (achievement badges grid)
  - "Sinf kodini kiriting" input (E-09 ga birlashgan)
  ```

### E-10 — Kurs Mazmuni
- [ ] **FE-10-1** — `src/app/student/courses/[id]/page.tsx`:
  ```
  - Modullar ro'yxati (qulflangan/ochiq holat)
  - Overall progress bar
  - Har modul klikka esa — mazmun ko'rinadi (markdown render)
  - "Vazifani boshlash" tugmasi (agar biriktirilgan bo'lsa)
  ```

### E-11 — Vazifani Yechish
- [ ] **FE-11-1** — `src/app/student/assignments/[id]/page.tsx` (asosiy container):
  ```
  - Format bo'yicha to'g'ri komponent ko'rsatiladi
  - Progress: "Savol 2/5"
  - "Javobni yuborish" tugmasi
  ```
- [ ] **FE-11-2** — `MCQSolver.tsx`:
  ```
  - 4 ta variant kartochka (hover effekti)
  - Tanlaganda: yashil (to'g'ri) yoki qizil (noto'g'ri) flash
  - Darhol AI izoh ko'rinadi (skeleton → matn)
  - XP animatsiyasi (+30 XP particle burst)
  ```
- [ ] **FE-11-3** — `FillSolver.tsx`:
  ```
  - Matn ichida bo'sh input maydonlar (inline)
  - "Tekshirish" tugmasi → barcha bo'shliqlar bir vaqtda baholanadi
  ```
- [ ] **FE-11-4** — `TimedQuizSolver.tsx`:
  ```
  - Fullscreen countdown taymer (yashil→sariq→qizil ranglar)
  - Taymer tugasa → avtomatik keyingi savolga o'tish
  - Progress taymer animatsiyasi (circular yoki linear)
  - requestAnimationFrame asosida custom hook: useCountdown(seconds)
  ```
- [ ] **FE-11-5** — `OpenAnswerSolver.tsx`:
  ```
  - Katta textarea (min-height: 200px)
  - Harf sanagich (500 max)
  - "Yuborish" → loading skeleton → AI baho keladi
  ```

### E-12 — Natija Ekrani
- [ ] **FE-12-1** — `src/app/student/assignments/[id]/results/page.tsx`:
  ```
  - Jami ball (katta, animatsiyali raqam)
  - Har savol uchun: to'g'ri/noto'g'ri + AI izoh
  - XP animatsiyasi: particle burst + "+N XP" floating text (Framer Motion)
  - "Keyingi vazifaga" / "Qayta urinish" tugmalar
  ```

### E-13 — Vaqtli Musobaqa
- [ ] **FE-13-1** — `src/app/student/assignments/[id]/timed/page.tsx`:
  ```
  - Fullscreen rejim
  - Katta taymer (markazda, animatsiyali)
  - Savol kartochkasi (oddiy MCQ)
  - Yakunida: sinf reytingi jadvali
  ```

### E-15 — Profil
- [ ] **FE-15-1** — `src/app/student/profile/page.tsx`:
  ```
  - XP tarixi (Recharts LineChart)
  - Daraja badge (1-6 daraja, hozirgi daraja)
  - Streak rekord
  - Yutuqlar to'liq ro'yxati (badge grid)
  - Avatar (mavjud bo'lsa)
  ```

**Muvaffaqiyat:** O'quvchi login → sinf kodi → kurs → vazifa yechish → natija zanjiri ishlaydi. XP animatsiyasi ko'rinadi.

---

## Phase 4 — Shared & Polish `[Kun 2 13:00–17:00]`

> Bu fazani ham parallel bajarish mumkin.

- [ ] **FE-04-S1** — Dark mode:
  ```typescript
  // Tailwind dark: prefix, ThemeProvider component
  // localStorage 'theme' key, system preference fallback
  // Toggle button header da
  ```
- [ ] **FE-04-S2** — Skeleton loaders (barcha AI so'rovlar uchun):
  ```typescript
  // <Skeleton className="h-4 w-full" /> — shadcn skeleton
  // Har SSE streaming boshlanishida ko'rinadi
  // Mazmun kelgandan keyin Framer Motion transition bilan yo'qoladi
  ```
- [ ] **FE-04-S3** — Mobile responsive tekshiruvi:
  ```
  - Chrome DevTools: 375px (iPhone SE), 390px (iPhone 14), 768px (iPad)
  - Navigation: mobile da bottom nav yoki hamburger menu
  - Vazifa yechish: touch-friendly button sizes (min 44px)
  - Timed quiz: fullscreen mobile da ham ishlashi
  ```
- [ ] **FE-04-S4** — Toast notifications (shadcn/ui Toaster):
  ```
  - Kurs yaratildi ✅
  - Sinf kodi nusxalandi 📋
  - Submission yuborildi ✅
  - Xato: "Network xatosi, qayta urinib ko'ring" ❌
  ```
- [ ] **FE-04-S5** — Loading holatlari (hech qachon bo'sh ekran):
  ```
  - Sahifa yuklanishida: Skeleton layout
  - AI streaming: yashil kursor blink animatsiya
  - Submission yuborilayotganda: "AI tekshirmoqda..." spinner
  ```
- [ ] **FE-04-S6** — Error boundary: unhandled xatolarni ushlab, foydalanuvchiga xabar berish
- [ ] **FE-04-S7** — Vercel deploy:
  ```bash
  vercel --prod
  # ENV: NEXT_PUBLIC_API_URL=https://eduflow-api.railway.app/api/v1
  ```

**Muvaffaqiyat:** Lighthouse score ≥ 80. Mobile da barcha asosiy funksiyalar ishlaydi.

---

## Ekranlar va fayllar xaritasi

| Ekran | Fayl | Holat |
|---|---|---|
| E-01 Login/Register | `app/(auth)/login/`, `register/` | FE-01 |
| E-02 Teacher Dashboard | `app/teacher/page.tsx` | FE-02-1 |
| E-03 Kurs yaratish | `app/teacher/courses/new/` | FE-03-1,2 |
| E-04 Kurs tahriri | `app/teacher/courses/[id]/edit/` | FE-04-1 |
| E-05 Vazifa yaratish | `app/teacher/assignments/new/` | FE-05-1,2 |
| E-06 Sinf boshqaruvi | `app/teacher/classes/[id]/` | FE-06-1 |
| E-07 Natijalar dashboard | `app/teacher/classes/[id]/results/` | FE-07-1 |
| E-08 Tasdiqlash navbati | `app/teacher/reviews/` | FE-08-1 |
| E-09 Student Dashboard | `app/student/page.tsx` | FE-09-1 |
| E-10 Kurs mazmuni | `app/student/courses/[id]/` | FE-10-1 |
| E-11 Vazifani yechish | `app/student/assignments/[id]/` | FE-11-1 to 5 |
| E-12 Natija ekrani | `app/student/assignments/[id]/results/` | FE-12-1 |
| E-13 Vaqtli musobaqa | `app/student/assignments/[id]/timed/` | FE-13-1 |
| E-15 Profil | `app/student/profile/` | FE-15-1 |

---

## Eng muhim komponentlar (MVP uchun critical):

1. `MCQSolver.tsx` — asosiy demo elementi
2. `AIStreamingView.tsx` — AI imkoniyatini ko'rsatadi
3. `TimedQuizSolver.tsx` — eng ta'sirli demo elementi
4. `XPAnimation.tsx` — gamifikatsiya vizuali
5. Teacher Dashboard — hakamlar birinchi ko'radigan narsa
