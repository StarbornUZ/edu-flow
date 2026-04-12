# Faza 6 — Frontend: Barcha Sahifalar
> **Mas'ul:** Amonov Ahmadjon (Admin+Teacher) · Amonov Aminjon (Student+Parent+Live)
> **Vaqt:** Kun 1 (08:00)–Kun 2 (15:00) — backend bilan parallel
> **Stack:** Next.js 14 App Router · TypeScript · Tailwind · shadcn/ui · Framer Motion

---

## Kontekst

Frontend strukturasi rollar bo'yicha ajratilgan. Har bir rol o'zining route gruppasiga ega.
API calls — TanStack Query orqali. Auth state — Zustand orqali.

---

## 6.0 — Setup (Kun 1, 08:00–09:00)

```bash
cd D:/Projects/starborn-eduflow
npx create-next-app@14 frontend --typescript --tailwind --app --src-dir --import-alias "@/*"
cd frontend
npx shadcn@latest init  # Style: default, color: slate, CSS variables: yes
```

**shadcn komponentlar o'rnatish:**
```bash
npx shadcn@latest add button card input dialog tabs progress badge avatar
npx shadcn@latest add skeleton toast dropdown-menu select textarea label
npx shadcn@latest add table sheet sidebar-07
```

**Qo'shimcha paketlar:**
```bash
npm install zustand @tanstack/react-query @tanstack/react-query-devtools
npm install react-hook-form zod @hookform/resolvers axios
npm install framer-motion recharts lucide-react
npm install react-markdown remark-gfm rehype-highlight
npm install katex rehype-katex remark-math
```

**Papka strukturasi:**
```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx          ← Dashboard
│   │   └── requests/page.tsx ← Org so'rovlar
│   ├── org/
│   │   ├── layout.tsx
│   │   ├── page.tsx          ← Org dashboard
│   │   ├── teachers/page.tsx
│   │   ├── students/page.tsx
│   │   └── classes/page.tsx
│   ├── teacher/
│   │   ├── layout.tsx
│   │   ├── page.tsx          ← Dashboard
│   │   ├── courses/
│   │   │   ├── page.tsx      ← Kurslar ro'yxati
│   │   │   ├── new/page.tsx  ← Yangi kurs
│   │   │   └── [id]/
│   │   │       ├── page.tsx  ← Kurs detail
│   │   │       └── topics/[topicId]/page.tsx
│   │   └── live/
│   │       ├── new/page.tsx  ← Musobaqa yaratish
│   │       └── [sessionId]/page.tsx ← Live boshqaruv
│   ├── student/
│   │   ├── layout.tsx
│   │   ├── page.tsx          ← Dashboard
│   │   ├── courses/
│   │   │   ├── page.tsx
│   │   │   └── [id]/topics/[topicId]/page.tsx
│   │   └── live/[sessionId]/page.tsx
│   └── parent/
│       ├── layout.tsx
│       └── page.tsx          ← Farzand statistikasi
├── components/
│   ├── ui/                   (shadcn)
│   ├── shared/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── RoleGuard.tsx
│   │   └── MarkdownRenderer.tsx
│   ├── teacher/
│   │   ├── CourseCard.tsx
│   │   ├── AIGenerateModal.tsx
│   │   └── ClassSelector.tsx
│   └── student/
│       ├── XPBar.tsx
│       ├── AssignmentCard.tsx
│       └── QuizWidget.tsx
├── lib/
│   ├── api.ts               ← Axios instance
│   ├── auth.ts              ← Token boshqaruvi
│   └── utils.ts
├── stores/
│   └── auth.store.ts        ← Zustand
└── types/
    └── index.ts
```

---

## 6.1 — Auth va API Setup

**`src/lib/api.ts`:**
```typescript
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Token qo'shish
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 da refresh qilish
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refresh_token: refresh }
        );
        localStorage.setItem("access_token", data.access_token);
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

**`src/stores/auth.store.ts`:**
```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "org_admin" | "teacher" | "student" | "parent";
  org_id: string | null;
  xp: number;
  level: number;
  streak_count: number;
}

interface AuthStore {
  user: User | null;
  access_token: string | null;
  setAuth: (user: User, token: string, refresh: string) => void;
  logout: () => void;
  isAuth: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      setAuth: (user, token, refresh) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", refresh);
        set({ user, access_token: token });
      },
      logout: () => {
        localStorage.clear();
        set({ user: null, access_token: null });
      },
      isAuth: () => !!get().access_token,
    }),
    { name: "auth-storage", partialize: (s) => ({ user: s.user }) }
  )
);
```

---

## 6.2 — Auth Sahifalar

**`src/app/(auth)/login/page.tsx`:**
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

const schema = z.object({
  email: z.string().email("Email noto'g'ri"),
  password: z.string().min(6, "Kamida 6 ta belgi"),
});

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      setError("");
      const res = await api.post("/auth/login", data);
      const { user, access_token, refresh_token } = res.data;
      setAuth(user, access_token, refresh_token);

      // Rolga qarab yo'naltirish
      const routes: Record<string, string> = {
        admin: "/admin",
        org_admin: "/org",
        teacher: "/teacher",
        student: "/student",
        parent: "/parent",
      };
      router.push(routes[user.role] || "/");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Kirish xatosi");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            <span className="text-blue-600">Edu</span>
            <span className="text-green-600">Flow</span>
          </CardTitle>
          <p className="text-center text-gray-500">Tizimga kirish</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input {...register("email")} type="email" placeholder="email@example.com" />
              {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Parol</Label>
              <Input {...register("password")} type="password" placeholder="••••••" />
              {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Kirish..." : "Kirish"}
            </Button>
          </form>
          <p className="text-center mt-4 text-sm text-gray-500">
            Hisobingiz yo'qmi?{" "}
            <a href="/register" className="text-blue-600 hover:underline">
              Ro'yxatdan o'tish
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 6.3 — Teacher Sahifalari (Ahmadjon mas'ul)

### Teacher Dashboard `(teacher/page.tsx)`
```tsx
// Ko'rsatiladigan ma'lumotlar:
// - Kurslar soni, sinflar soni, o'quvchilar soni
// - Kutilayotgan baholash soni (ochiq javoblar)
// - Oxirgi faollik (assignment submissions)
// - AI insights (analyze-stats dan)
// - "Yangi kurs yaratish" tugmasi (AI modal bilan)
```

### Yangi Kurs Sahifasi `(teacher/courses/new/page.tsx)`
```tsx
// 2 ta variant:
// 1. "AI bilan yarat" - modal ochiladi
//    - Fan tanlash (subjects ro'yxatidan)
//    - Sinf darajasi (1-11)
//    - Maqsad matni
//    - Modullar soni (1-5)
//    - Generate tugmasi → SSE stream ko'rsatadi (skeleton + text chunklari)
//    - Tugagach: "Kursni saqlash" tugmasi
//
// 2. "Qo'lda yarat" - to'g'ridan-to'g'ri forma

// AI SSE stream qabul qilish:
async function streamCourse(data: any) {
  const response = await fetch("/api/v1/ai/generate-course", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
    body: JSON.stringify(data),
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.text) setStreamedText(prev => prev + data.text);
        if (data === "[DONE]") break;
      }
    }
  }
}
```

### Kurs Detail `(teacher/courses/[id]/page.tsx)`
```tsx
// Tabs:
// 1. "Modullar" - collapsible tree: Module > Topic > Assignment
// 2. "Sinflar" - biriktrilgan sinflar ro'yxati, biriktirish/olib tashlash
// 3. "O'quvchilar" - progress table
// 4. "Natijalar" - submissions overview
```

### Mavzu Tahrirlash `(teacher/courses/[id]/topics/[topicId]/page.tsx)`
```tsx
// Markdown editor (textarea yoki simple editor)
// LaTeX preview (katex)
// Video URL input
// "AI bilan to'ldirish" tugmasi
// "Saqlash" tugmasi
```

---

## 6.4 — Admin Sahifalari (Ahmadjon mas'ul)

### Admin Dashboard `(admin/page.tsx)`
```tsx
// - Jami tashkilotlar soni, foydalanuvchilar, oylik daromad
// - Kutilayotgan so'rovlar soni (badge bilan)
// - So'rovlar jadval ko'rinishida (keyingi sahifaga link)
```

### Org So'rovlari `(admin/requests/page.tsx)`
```tsx
// Jadval: Tashkilot nomi | Turi | Telefon | Yuboruvchi | Sana | Status | Amallar
// "Tasdiqlash" tugmasi → PUT /organizations/requests/{id} {action: "approve"}
// "Rad etish" tugmasi → dialog (izoh yozish) → {action: "reject", note: "..."}
// Filter: pending / approved / rejected
```

---

## 6.5 — Org-Admin Sahifalari (Ahmadjon mas'ul)

### Org Dashboard `(org/page.tsx)`
```tsx
// - Stats cards: o'qituvchilar, o'quvchilar, sinflar, kurslar
// - Quick actions: "Yangi o'qituvchi", "Yangi sinf", "Yangi o'quvchi"
```

### Sinflar `(org/classes/page.tsx)`
```tsx
// Jadval: Sinf nomi | Daraja | O'qituvchi | O'quvchilar soni | Amallar
// "Yangi sinf" modal: nom, daraja, asosiy o'qituvchi tanlash
// Sinf kartasidan: o'quvchi qo'shish/olib tashlash
```

---

## 6.6 — Student Sahifalari (Aminjon mas'ul)

### Student Dashboard `(student/page.tsx)`
```tsx
// - XP progress bar + daraja badge
// - Streak indicator (🔥 5 kun)
// - Nishonlar (eng oxirgi 3 ta)
// - Kurslar ro'yxati (o'z kurslari)
// - "Davom etish" — oxirgi o'qilgan mavzu
```

### Kurslar `(student/courses/page.tsx)`
```tsx
// Kurs kartalar: nom, progress (%), o'qituvchi, mavzular soni
```

### Mavzu O'qish `(student/courses/[id]/topics/[topicId]/page.tsx)`
```tsx
// - MarkdownRenderer komponenti (react-markdown + remark-gfm + katex)
// - Video embed (YouTube iframe)
// - "Vazifalar" bo'limi pastda
// - Vazifa widget (QuizWidget komponenti)

// MarkdownRenderer:
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      className="prose prose-slate max-w-none"
    >
      {content}
    </ReactMarkdown>
  );
}
```

### Vazifa (QuizWidget) — `components/student/QuizWidget.tsx`
```tsx
// Prop: assignment (MCQ | Fill | Open)
// MCQ: 4 ta tugma (A/B/C/D), bosgach → /assignments/{id}/submit
//      Javobdan keyin: AI feedback qutisi (isCorrect + explanation)
//      XP animatsiyasi (+20 XP) — framer-motion
// Fill: input maydoni → submit
// Open: textarea → submit → "AI tekshiryapti..." → feedback
```

---

## 6.7 — Parent Sahifasi (Aminjon mas'ul)

**`(parent/page.tsx)`:**
```tsx
// - Farzand card: ism, daraja, XP, streak
// - Kurslar bo'yicha progress (progress bar)
// - Oxirgi hafta faolligi (mini bar chart - Recharts)
// - Nishonlar (earned badges)
// - "PDF hisobot" tugmasi (kelajakda)
// API: GET /dashboard/parent/{parent_id}
```

---

## 6.8 — Shared Komponentlar

**`components/shared/RoleGuard.tsx`:**
```tsx
"use client";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RoleGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (!allowedRoles.includes(user.role)) { router.push("/login"); }
  }, [user]);

  if (!user || !allowedRoles.includes(user.role)) return null;
  return <>{children}</>;
}
```

**`components/student/XPBar.tsx`:**
```tsx
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

// XP level thresholds
const THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500];

export function XPBar({ xp, level }: { xp: number; level: number }) {
  const current = THRESHOLDS[level - 1] || 0;
  const next = THRESHOLDS[level] || 9999;
  const progress = ((xp - current) / (next - current)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>Daraja {level}</span>
        <span>{xp} / {next} XP</span>
      </div>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ transformOrigin: "left" }}
      >
        <Progress value={progress} className="h-3" />
      </motion.div>
    </div>
  );
}
```

---

## 6.9 — `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

Production uchun:
```env
NEXT_PUBLIC_API_URL=https://eduflow-backend.railway.app/api/v1
NEXT_PUBLIC_WS_URL=wss://eduflow-backend.railway.app
```

---

## Muvaffaqiyat mezoni

- [ ] Login → to'g'ri roli sahifasiga redirect
- [ ] Teacher: kurs yaratish (qo'lda) va mavzu qo'shish ishlaydi
- [ ] Teacher: AI bilan kurs generatsiyasi SSE stream ko'rinadi
- [ ] Student: mavzu Markdown + LaTeX to'g'ri render qilinadi
- [ ] Student: MCQ vazifa yechish + AI feedback ishlaydi
- [ ] Admin: org so'rovlarni ko'rish va tasdiqlash ishlaydi
- [ ] Parent: farzand statistikasi ko'rinadi
- [ ] Student: Live musobaqa sahifasi (WS) ishlaydi
- [ ] Responsive: mobil qurilmada ham o'qiladi
