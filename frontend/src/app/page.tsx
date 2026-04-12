"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  Zap,
  Trophy,
  Users,
  Brain,
  BarChart3,
  CheckCircle,
  ArrowRight,
  GraduationCap,
  School,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore, roleRoutes } from "@/stores/auth.store";

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("eduflow-auth");
    return raw ? JSON.parse(raw)?.state?.user ?? null : null;
  } catch {
    return null;
  }
}

const features = [
  {
    icon: Brain,
    title: "AI bilan kurs yaratish",
    desc: "O'qituvchi fan va sinf darajasini kiritadi — AI modul, mavzu va vazifalarni avtomatik yaratadi.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: Zap,
    title: "Avtomatik baholash",
    desc: "Ochiq javobli vazifalarni AI tekshiradi, ball va batafsil izoh beradi. O'qituvchi vaqtini tejaydi.",
    color: "bg-purple-100 text-purple-600",
  },
  {
    icon: Trophy,
    title: "Gamification",
    desc: "XP, darajalar, streak va nishonlar orqali o'quvchilarni rag'batlantirish. Duolingo uslubi.",
    color: "bg-yellow-100 text-yellow-600",
  },
  {
    icon: Users,
    title: "Interaktiv musobaqalar",
    desc: "Blitz Jang, Omad Sinovi, Zanjir Savol — 7 xil o'yin formati bilan jonli dars musobaqalari.",
    color: "bg-green-100 text-green-600",
  },
  {
    icon: BarChart3,
    title: "Real-time statistika",
    desc: "O'quvchi progressi, sinf reytingi, zaif mavzular — barchasi bir dashboardda.",
    color: "bg-orange-100 text-orange-600",
  },
  {
    icon: GraduationCap,
    title: "Ota-ona monitoring",
    desc: "Ota-onalar farzandining kurslar, vazifalar va XP statistikasini real-time ko'radi.",
    color: "bg-pink-100 text-pink-600",
  },
];

const steps = [
  {
    num: "01",
    title: "Tashkilotni ro'yxatdan o'tkaring",
    desc: "Maktab yoki o'quv markazingiz ma'lumotlarini kiriting. Administrator 24 soat ichida tasdiqlaydi.",
  },
  {
    num: "02",
    title: "O'qituvchi va sinflarni qo'shing",
    desc: "O'qituvchilar, o'quvchilar va sinflarni platformaga qo'shing. AI kurs yaratishni boshlang.",
  },
  {
    num: "03",
    title: "O'qitishni boshlang",
    desc: "O'quvchilar kurslarni o'qiydi, vazifalarni bajaradi va musobaqalarda ishtirok etadi.",
  },
];

const plans = [
  { name: "Starter", price: "$50", desc: "≤5 ta sinf", color: "border-gray-200" },
  { name: "Growth", price: "$100", desc: "6–15 sinf", color: "border-blue-500", popular: true },
  { name: "Scale", price: "$200", desc: "15+ sinf", color: "border-gray-200" },
];

export default function HomePage() {
  const router = useRouter();
  const storeUser = useAuthStore((s) => s.user);

  useEffect(() => {
    const user = storeUser ?? getStoredUser();
    if (user) {
      router.replace(roleRoutes[user.role] || "/login");
    }
  }, [storeUser, router]);

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
              EduFlow
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-gray-600 sm:flex">
            <a href="#features" className="hover:text-gray-900 transition-colors">Xususiyatlar</a>
            <a href="#how" className="hover:text-gray-900 transition-colors">Qanday ishlaydi</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Narxlar</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Kirish</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register?role=org_admin">Tashkilot yaratish</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-green-50 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="secondary" className="mb-4 text-sm">
              O'zbek tilidagi birinchi AI ta'lim platformasi
            </Badge>
            <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Maktabingizni{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                raqamlashtiring
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
              O'qituvchi AI yordamida dars yaratadi, o'quvchi gamification bilan o'rganadi,
              ota-ona real-time nazorat qiladi — barchasi bir platformada.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" className="gap-2 px-8" asChild>
                <Link href="/register?role=org_admin">
                  Tashkilotni ro&apos;yxatdan o&apos;tkaring
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Hisobga kirish</Link>
              </Button>
            </div>
          </motion.div>
        </div>
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-blue-100 opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-green-100 opacity-40 blur-3xl" />
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="border-y bg-gray-50 py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-3 divide-x px-4">
          {[
            { val: "10,943", label: "O'zbekistondagi maktablar" },
            { val: "6.78M", label: "O'quvchilar" },
            { val: "99.6%", label: "Maktablar internetga ulangan" },
          ].map((s) => (
            <div key={s.label} className="px-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{s.val}</p>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Nima uchun EduFlow?</h2>
            <p className="mt-3 text-gray-500">Barcha zarur vositalar bir joyda</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`mb-4 inline-flex rounded-lg p-2.5 ${f.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section id="how" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Qanday ishlaydi?</h2>
            <p className="mt-3 text-gray-500">3 qadamda boshlang</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative text-center"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white text-xl font-bold">
                  {s.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute left-[calc(50%+28px)] top-7 hidden h-0.5 w-[calc(100%-56px)] bg-blue-200 sm:block" />
                )}
                <h3 className="mb-2 font-semibold text-gray-900">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Narxlar</h2>
            <p className="mt-3 text-gray-500">30 kunlik bepul sinash — karta talab etilmaydi</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-xl border-2 bg-white p-6 text-center shadow-sm ${p.color} ${p.popular ? "shadow-lg" : ""}`}
              >
                {p.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Eng mashhur</Badge>
                )}
                <p className="text-lg font-bold text-gray-900">{p.name}</p>
                <p className="mt-1 text-4xl font-extrabold text-blue-600">{p.price}</p>
                <p className="mt-1 text-sm text-gray-500">/oy · {p.desc}</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  {["Cheksiz o'quvchilar", "AI kurs generatsiyasi", "Real-time musobaqalar", "Ota-ona monitoring"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={p.popular ? "default" : "outline"} asChild>
                  <Link href="/register?role=org_admin">Boshlash</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <School className="mx-auto mb-4 h-12 w-12 opacity-80" />
          <h2 className="mb-3 text-3xl font-bold">Tashkilotingizni hoziroq ro&apos;yxatdan o&apos;tkaring</h2>
          <p className="mb-8 text-blue-100">
            30 kunlik bepul sinash. Kredit karta talab etilmaydi.
          </p>
          <Button size="lg" variant="secondary" className="gap-2 px-10" asChild>
            <Link href="/register?role=org_admin">
              Bepul boshlash
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-gray-700">EduFlow</span>
        </div>
        <p>© 2026 EduFlow. Barcha huquqlar himoyalangan.</p>
      </footer>
    </div>
  );
}
