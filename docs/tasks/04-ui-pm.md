# UI/UX + PM — Vazifalar ro'yxati

**Rol:** UI/UX Designer + Project Manager
**Texnologiyalar:** Figma, Framer Motion, Tailwind CSS, shadcn/ui
**Mas'uliyat:** Dizayn tizimi, animatsiyalar, demo stsenariysi, jamoani koordinatsiya qilish

> Dizayn ishlari har doim **parallel** bajariladi — backend tayyor bo'lishini kutmaydi.
> PM funksiyasi: jamoani sinxronlashtirish, checkpoint larda blokirovkalarni hal qilish.

---

## Phase 0 — Dizayn Tizimi `[DARHOL, Kun 1 08:00–11:00]`

> Barcha rollar bilan **parallel**. Bu faza boshqa hamma ishning asosi.

- [ ] **PM-00-1** — Figma faylini yaratish: "EduFlow Design System"
  ```
  Sahifalar:
  1. Colors & Typography
  2. Components
  3. Teacher Screens (E-02 to E-08)
  4. Student Screens (E-09 to E-15)
  5. Mobile Layouts
  ```
- [ ] **PM-00-2** — Rang palitasi (Figma va Tailwind da):
  ```css
  /* Asosiy ranglar */
  --primary: #2563EB;       /* Ko'k — asosiy action */
  --primary-dark: #1D4ED8;  /* Hover holati */
  --success: #16A34A;       /* To'g'ri javob, muvaffaqiyat */
  --warning: #B45309;       /* Ogohlantirish */
  --error: #DC2626;         /* Xato, noto'g'ri javob */
  --neutral: #6B7280;       /* Ikkinchi darajali matn */
  --bg-light: #F9FAFB;      /* Sahifa foni (light) */
  --bg-dark: #111827;       /* Sahifa foni (dark) */
  ```
- [ ] **PM-00-3** — Tipografiya (Inter font):
  ```
  H1: 32px / 700 weight   — Sahifa sarlavhasi
  H2: 24px / 700          — Bo'lim sarlavhasi
  H3: 18px / 600          — Karta sarlavhasi
  Body: 16px / 400        — Asosiy matn
  Small: 14px / 400       — Yorliqlar, meta info
  Minimal: 12px / 400     — Badge, caption
  ```
- [ ] **PM-00-4** — Komponent kutubxonasi (Figma):
  ```
  Button:   Primary | Secondary | Ghost | Destructive | Loading state
  Card:     Default | Hover | Selected
  Input:    Default | Focus | Error | Disabled
  Badge:    Draft (kulrang) | Published (yashil) | Pending (sariq)
  Avatar:   Initials | Photo | Level ring
  Progress: Linear | Circular (XP ring)
  ```
- [ ] **PM-00-5** — `tailwind.config.ts` ga rang tokenlarni qo'shish:
  ```typescript
  colors: {
    primary: { DEFAULT: '#2563EB', dark: '#1D4ED8', light: '#DBEAFE' },
    success: '#16A34A',
    warning: '#B45309',
    error: '#DC2626',
  }
  ```

**Muvaffaqiyat:** Figma da dizayn tizimi tayyor. Tailwind ranglar konfiguratsiyada.

---

## Phase 1 — Asosiy Ekranlar Dizayni `[Kun 1 11:00–17:00]`

> FE developer bilan yaqin koordinatsiyada. Har ekran uchun — Figma + komponent tayyor.

### Teacher side ekranlar:

- [ ] **PM-01-1** — **E-02: Teacher Dashboard** wireframe:
  ```
  Header: Logo | "O'qituvchi Paneli" | Avatar + logout
  Stats bar: 3 ta karta (Kurslar soni | Sinflar | Kutayotgan tekshiruvlar)
  Main grid:
    - Kurslar (karta view, status badge, "Tahrirlash" tugma)
    - Sinflar (list view, o'quvchi soni, sinf kodi pill)
  ```
- [ ] **PM-01-2** — **E-03: Kurs Yaratish** wireframe:
  ```
  Tabs: [Qo'lda | AI bilan yarat]
  AI tab:
    - Fan inputi + maqsad textarea
    - "Kurs yaratish" tugmasi (primary, katta)
    - AI streaming panel: qora fon, yashil kursor, matn paydo bo'ladi
    - Progress: "Modul 2/5 generatsiya qilinmoqda..."
  ```
- [ ] **PM-01-3** — **E-05: Vazifa Yaratish** format picker:
  ```
  6 ta format kartochka (icon + nom + qisqa tavsif)
  MCQ    [☑] | Fill [___] | Timed [⏱] | Match [↔] | Order [↕] | Open [✍]
  Tanlaganda — to'g'ri savol builder ko'rsatiladi
  ```
- [ ] **PM-01-4** — **E-08: Tasdiqlash Navbati** UI:
  ```
  Har karta:
    - O'quvchi ismi + submission vaqti
    - Savol matni
    - O'quvchi javobi (quoted box)
    - AI ball: "78/100" + AI izoh
    - [✓ Tasdiqlash] | [✎ O'zgartirish] tugmalar
    - O'zgartirishda: number slider + izoh input
  ```

### Student side ekranlar:

- [ ] **PM-01-5** — **E-09: Student Dashboard** hero section:
  ```
  Yuqori: XP circular ring (animatsiyali, gradient stroke)
  O'rta: Streak olov 🔥 N kun (pulse animatsiya)
  Past: Faol kurslar (progress bar lar)
  ```
- [ ] **PM-01-6** — **E-11: MCQ Yechish** karta UI:
  ```
  Savol: Katta, aniq matn
  4 ta variant karta (50px height, hover: shadow)
  Tanlaganda:
    - To'g'ri: yashil background + ✓ belgisi + "Ajoyib!" flash
    - Noto'g'ri: qizil background + ✗ + shake animatsiya
  AI izoh: karta pastida paydo bo'ladi (slide-down animatsiya)
  XP pill: "+30 XP" float up va yo'qoladi
  ```
- [ ] **PM-01-7** — **E-13: Vaqtli Musobaqa** timer dizayni:
  ```
  Fullscreen: qora/to'q fon
  Markazda: katta circular taymer (90px radius)
    - 60% dan yuqori: yashil stroke
    - 30-60%: sariq stroke
    - 0-30%: qizil stroke + pulse
  Savol: Markazda, katta shrift
  4 ta variant: pastda grid
  ```

**Muvaffaqiyat:** Barcha asosiy ekranlar Figma da wireframe sifatida tayyor.

---

## Phase 2 — Framer Motion Animatsiyalar `[Kun 2 13:00–15:00]`

> Frontend developer bilan **birgalikda** (kod animatsiyalarni yozadi, PM spec beradi).

- [ ] **PM-02-1** — **XP Gain animatsiya** (`XPAnimation.tsx`):
  ```
  Trigger: to'g'ri javob bergandan keyin
  Animatsiya:
    1. "+30 XP" matni savol ustida paydo bo'ladi (scale 0 → 1.2 → 1)
    2. Yuqoriga float qiladi (y: 0 → -80px)
    3. Yo'qoladi (opacity: 1 → 0)
    4. XP ring animatsiyali to'ldiriladi
  Duration: 1.5s total
  ```
  ```typescript
  // Framer Motion implementation:
  <motion.div
    initial={{ opacity: 0, y: 0, scale: 0 }}
    animate={{ opacity: [0, 1, 1, 0], y: [0, -20, -60, -80], scale: [0, 1.2, 1, 0.8] }}
    transition={{ duration: 1.5, times: [0, 0.2, 0.7, 1] }}
    className="absolute text-2xl font-bold text-yellow-400"
  >
    +{xp} XP
  </motion.div>
  ```
- [ ] **PM-02-2** — **Streak olov** animatsiyasi:
  ```
  - Kundalik kirish: 🔥 belgisi scale 1 → 1.5 → 1 (pulse)
  - Streak yangilanganda: particle confetti (3-5 ta spark)
  - Streak uzilganda: 🔥 grey rangga o'tadi (scale down)
  ```
- [ ] **PM-02-3** — **Daraja oshishi** modali:
  ```
  Trigger: level threshold ga yetilganda
  Modal: confetti animatsiya + "2-DARAJA!" katta matn
  Badge animatsiyasi: rotate 360° + scale effekt
  Auto close: 3 soniyadan keyin
  ```
- [ ] **PM-02-4** — **MCQ To'g'ri/Noto'g'ri** animatsiyalar:
  ```
  To'g'ri:
    - Karta: background white → green (200ms ease)
    - Checkmark SVG: draw animation (stroke-dashoffset)
  Noto'g'ri:
    - Karta shake: x [0, -10, 10, -10, 10, 0] (400ms)
    - Background → red (200ms)
    - To'g'ri variant: highlight (yashil outline)
  ```
- [ ] **PM-02-5** — **AI Streaming** kursor animatsiyasi:
  ```
  - Matn paydo bo'layotganda: kursor blink (| belgisi)
  - Har yangi belgi: opacity effekt
  - Tugatganda: kursor yo'qoladi, fade-in effekt
  ```
- [ ] **PM-02-6** — **Page transitions**: sahifalar orasida smooth slide
  ```typescript
  // layout.tsx da AnimatePresence + motion.div wrapper
  ```
- [ ] **PM-02-7** — **Skeleton → Mazmun** transition:
  ```
  Skeleton opacity 1 → 0 (200ms)
  Mazmun opacity 0 → 1 (200ms)
  ```

**Muvaffaqiyat:** Barcha animatsiyalar Figma prototyp da ko'rsatilgan + kod yozilgan.

---

## Phase 3 — Demo Stsenariysi `[Kun 2 13:00–15:00]`

> PM asosiy mas'ul. Jamoaning barcha a'zolari bilan **birgalikda** mashq qilish.

- [ ] **PM-03-1** — Demo stsenariysi hujjati (8 qadam):

  ```markdown
  ## Demo Script — 5 daqiqa

  ### Qadam 1: O'qituvchi kiradi (30 soniya)
  - URL: https://eduflow.vercel.app
  - Login: teacher@demo.uz / Demo1234!
  - Dashboard ko'rsatiladi (kurslar, sinflar)

  ### Qadam 2: AI bilan kurs yaratish (60 soniya)
  - "Kurs yaratish" → "AI bilan yarat" tab
  - Fan: "Matematika", Daraja: "8-sinf", Maqsad: "Algebra asoslari"
  - "Yaratish" tugma bosiladi
  - LIVE: matn token-token ko'rinadi (hakamlar ko'radi)
  - Kurs tayyor → "Birinchi modulni ko'rish" bosiladi
  - Bir modul tahrirlanadi → "Chop etish"

  ### Qadam 3: Sinf + vazifa (60 soniya)
  - "Sinf yaratish": "8-A sinfi"
  - Sinf kodi ekranda katta ko'rinadi: ABC123
  - "AI bilan vazifa": MCQ + Vaqtli musobaqa kombinatsiyasi
  - "Chop etish" → sinfga biriktiriladi

  ### Qadam 4: O'quvchi kiradi (30 soniya)
  - [Boshqa brauzer/oyna/telefon]
  - Register: student@demo.uz / Demo1234!
  - Sinf kodi kiritiladi: ABC123
  - Kurslar ko'rinadi

  ### Qadam 5: MCQ yechish (30 soniya)
  - Vazifani boshlash
  - Javob tanlanadi
  - LIVE: darhol AI izoh ko'rinadi (+30 XP animatsiyasi)

  ### Qadam 6: Ochiq savol (30 soniya)
  - Keyingi savol: ochiq javob
  - Matn yoziladi → "Yuborish"
  - AI baho: "85/100 + izoh"

  ### Qadam 7: O'qituvchi dashboard (30 soniya)
  - O'qituvchi tabiga qaytish
  - Sinf statistika ko'rinadi
  - "Tasdiqlash navbati" → AI ball → "Tasdiqlash" bosiladi

  ### Qadam 8: Pitch xulosasi (30 soniya)
  - "Biz 2 ta hackathon muammosini bitta platformada yechdik"
  - "FastAPI + Next.js + Claude AI"
  - QR code: jonli URL
  ```

- [ ] **PM-03-2** — Demo uchun test ma'lumotlari (seed data):
  ```
  teacher@demo.uz — tayyor kurs + sinf + vazifalar
  student@demo.uz — sinfga qo'shilgan, bir submission tayyor
  # Script: python scripts/seed_demo_data.py
  ```
- [ ] **PM-03-3** — Zaxira rejasi (live demo ishlamasa):
  ```
  - Barcha 8 qadam screenshot larini tayyorlash
  - Loom/screen recording ham tayyorlab qo'yish
  - Local da ham ishlashini tekshirish
  ```
- [ ] **PM-03-4** — Pitch slide deck (5-7 slayd):
  ```
  Slayd 1: "EduFlow" — qisqa tavsif + stack
  Slayd 2: Muammo (2 ta muammo, statistika)
  Slayd 3: Yechim (EduFlow = O'qituvchi + O'quvchi + AI)
  Slayd 4: [DEMO — jonli sayt]
  Slayd 5: Texnik arxitektura (oddiy diagramma)
  Slayd 6: Hackathon treklar muvofiqligi
  Slayd 7: Keyingi qadamlar + QR kod
  ```
- [ ] **PM-03-5** — Hakamlar savollari tayyorlash:
  ```
  S: AI noto'g'ri baho bersa?
  J: Open answer uchun AI taklif qiladi, o'qituvchi tasdiqlaydi. Intentional design.

  S: Duolingo/Google Classroom dan farqi?
  J: Duolingo — til, Google — LMS. EduFlow = ikkalasini birlashtiradi + o'zbek tili.

  S: 10,000 foydalanuvchi bo'lsa?
  J: PostgreSQL + Redis + Celery. Railway → AWS 1 kunda ko'chirib olinadi.

  S: Xavfsizlik?
  J: JWT + bcrypt + UUID + RBAC + rate limiting. HTTPS everywhere.
  ```
- [ ] **PM-03-6** — Demo mashqi: 2 marta to'liq run-through (Kun 2 kechqurun)

**Muvaffaqiyat:** Demo 5 daqiqada, xatosiz, silliq o'tadi. Zaxira rejasi mavjud.

---

## Phase 4 — QA Checklist `[Kun 2 15:00–17:00]`

> Barcha rollar bilan birgalikda — PM koordinatsiya qiladi.

### Funksional tekshiruv:
- [ ] **QA-01** — Login (teacher va student) → dashboard ishlaydi
- [ ] **QA-02** — AI kurs generatsiyasi → SSE stream ko'rinadi → kurs saqlanadi
- [ ] **QA-03** — Sinf yaratish → sinf kodi avtomatik → o'quvchi sinf kodini kiritib qo'shiladi
- [ ] **QA-04** — MCQ vazifa yaratish + chop etish → student ko'radi
- [ ] **QA-05** — MCQ yechish → darhol AI izoh → XP qo'shiladi
- [ ] **QA-06** — Ochiq savol yechish → AI baho → teacher tasdiqlaydi
- [ ] **QA-07** — Vaqtli musobaqa → taymer ishlaydi → vaqt tugaganda keyingi savolga o'tadi
- [ ] **QA-08** — Teacher dashboard → sinf statistika ko'rinadi
- [ ] **QA-09** — XP va streak to'g'ri yangilanadi
- [ ] **QA-10** — Deploy: Vercel URL ochiq, Railway URL ochiq

### Vizual tekshiruv:
- [ ] **QA-11** — Dark mode ishlaydi, localStorage da saqlanadi
- [ ] **QA-12** — Mobile: 375px da barcha asosiy funksiyalar ishlaydi
- [ ] **QA-13** — Skeleton loaders barcha AI so'rovlarda ko'rinadi
- [ ] **QA-14** — XP animatsiyasi ko'rinadi (+30 XP float)
- [ ] **QA-15** — Error toast xabarlar ko'rinadi (tarmoq xatosi holatida)

### Xavfsizlik tekshiruv (PM + Backend):
- [ ] **QA-16** — Student teacher endpointga kirsa → 403 qaytadi
- [ ] **QA-17** — Token yo'q holda → /login ga redirect
- [ ] **QA-18** — Rate limiting: login ga 6+ urinish → bloklanadi

---

## PM Koordinatsiya Vazifalari

### Kun 1 soatligi:
- [ ] **PM-K1-1** — 08:00: Barcha dastlabki vazifalarni taqsimlash, Git branches yaratish
- [ ] **PM-K1-2** — 11:00: Birinchi sync — setup ishlayaptimi?
- [ ] **PM-K1-3** — 13:00: **Checkpoint 1** — "Login → Kurs → Sinf zanjiri ishlayaptimi?"
- [ ] **PM-K1-4** — 17:00: Backend-Frontend integratsiyasini tekshirish
- [ ] **PM-K1-5** — 19:00: **Checkpoint 2** — Kun 1 demo zanjirini to'liq test qilish
- [ ] **PM-K1-6** — 21:00: Kun 2 rejasini yangilash (blokerlar bo'lsa prioritet o'zgartirish)

### Kun 2 soatligi:
- [ ] **PM-K2-1** — 08:00: Kun 2 vazifalarini taqsimlash
- [ ] **PM-K2-2** — 12:00: **Checkpoint 3** — To'liq demo zanjir sinov
- [ ] **PM-K2-3** — 13:00: Polishing bosqichini boshlash (PM koordinatsiya)
- [ ] **PM-K2-4** — 15:00: QA checklist o'tkazish
- [ ] **PM-K2-5** — 17:00: **Final deploy** + demo mashqi
- [ ] **PM-K2-6** — 18:00: Pitch tayyorlash tugadi

---

## Tavsiyalar (PM sifatida):

### Bloker uchun qoida:
> Biror vazifa 30 daqiqa davomida to'xtab qolsa → darhol PM ga xabar. PM jamoa darajasida hal qiladi yoki prioritetni o'zgartiradi.

### Git workflow:
```bash
main ← develop ← feature/be-auth
                ← feature/fe-login
                ← feature/ai-course-gen
# Har bir feature → PR → develop → merge
# Kun oxirida: develop → main → deploy
```

### Kritik vazifalarni kechiktirmang:
```
❌ Demo arxiv: Matching + Ordering formatlari — KECHIKTIRING
✅ Demo chain: MCQ + Open + Timed — BIRINCHI bajaring
```
