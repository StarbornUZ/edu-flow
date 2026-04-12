"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Building2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useAuthStore, roleRoutes } from "@/stores/auth.store";
import type { AuthResponse } from "@/types";

const schema = z.object({
  full_name: z.string().min(2, "Ism kamida 2 ta belgidan iborat bo'lishi kerak"),
  email: z.string().email("Email formati noto'g'ri"),
  password: z.string().min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak"),
  role: z.enum(["teacher", "student", "org_admin"]),
  // Org fields (required only for org_admin)
  org_name: z.string().optional(),
  org_type: z.enum(["school", "learning_center", "university"]).optional(),
  org_responsible: z.string().optional(),
  org_phone: z.string().optional(),
  org_address: z.string().optional(),
  org_stir: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.role === "org_admin") {
    if (!data.org_name || data.org_name.trim().length < 2) {
      ctx.addIssue({ code: "custom", path: ["org_name"], message: "Tashkilot nomi kiritilishi shart" });
    }
    if (!data.org_type) {
      ctx.addIssue({ code: "custom", path: ["org_type"], message: "Tashkilot turini tanlang" });
    }
  }
});

type FormData = z.infer<typeof schema>;

const orgTypeLabels = [
  { value: "school", label: "Maktab" },
  { value: "learning_center", label: "O'quv markaz" },
  { value: "university", label: "Universitet" },
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "org_admin" ? "org_admin" : "student";

  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [orgRequestSent, setOrgRequestSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: initialRole, org_type: "school" },
  });

  const selectedRole = watch("role");
  const isOrgAdmin = selectedRole === "org_admin";

  const onSubmit = async (values: FormData) => {
    try {
      setError(null);

      // 1. Register user
      const { data } = await api.post<AuthResponse>("/auth/register", {
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        role: values.role,
      });

      setAuth(data.user, data.tokens.access_token, data.tokens.refresh_token);

      // 2. If org_admin, submit org request immediately
      if (values.role === "org_admin") {
        await api.post("/organizations/requests", {
          org_data: {
            name: values.org_name,
            type: values.org_type,
            responsible_person: values.org_responsible,
            phone: values.org_phone,
            address: values.org_address,
            stir: values.org_stir,
          },
        });
        setOrgRequestSent(true);
        return;
      }

      router.push(roleRoutes[data.user.role] || "/login");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } };
      const raw = axiosErr.response?.data?.detail;
      let message = "Ro'yxatdan o'tishda xatolik yuz berdi";
      if (typeof raw === "string") {
        message = raw;
      } else if (Array.isArray(raw)) {
        message = raw
          .map((e: unknown) =>
            typeof e === "object" && e !== null && "msg" in e
              ? String((e as { msg: unknown }).msg)
              : JSON.stringify(e)
          )
          .join(", ");
      }
      setError(message);
      toast.error(message);
    }
  };

  // Org request submitted — show confirmation screen
  if (orgRequestSent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md px-4"
      >
        <Card>
          <CardContent className="pt-10 pb-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">So&apos;rovingiz yuborildi!</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tashkilot yaratish so&apos;rovingiz administratorga yuborildi.
              Tasdiqlangandan so&apos;ng email orqali xabardor qilinasiz va
              tashkilotingiz faollashadi.
            </p>
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              Kutish vaqti: <strong>24 soat ichida</strong>
            </div>
            <Button className="w-full" asChild>
              <Link href="/org">Boshqaruv paneliga o&apos;tish</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-lg px-4 py-8"
    >
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                EduFlow
              </span>
            </div>
          </div>
          <CardTitle className="text-2xl">Ro&apos;yxatdan o&apos;tish</CardTitle>
          <CardDescription>Yangi hisob yarating</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Role selector */}
            <div className="space-y-2">
              <Label>Kim siz?</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "student", label: "O'quvchi", color: "border-green-500 bg-green-50 text-green-700" },
                  { value: "teacher", label: "O'qituvchi", color: "border-blue-500 bg-blue-50 text-blue-700" },
                  { value: "org_admin", label: "Tashkilot", color: "border-purple-500 bg-purple-50 text-purple-700" },
                ].map((r) => (
                  <label
                    key={r.value}
                    className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-colors ${
                      selectedRole === r.value ? r.color : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setValue("role", r.value as FormData["role"])}
                  >
                    <input type="radio" value={r.value} {...register("role")} className="sr-only" />
                    <span className="text-sm font-medium">{r.label}</span>
                  </label>
                ))}
              </div>
              {errors.role && <p className="text-sm text-red-500">{errors.role.message}</p>}
            </div>

            {/* Basic fields */}
            <div className="space-y-2">
              <Label htmlFor="full_name">To&apos;liq ism</Label>
              <Input id="full_name" placeholder="Ismingiz" {...register("full_name")} />
              {errors.full_name && <p className="text-sm text-red-500">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="email@example.com" {...register("email")} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input id="password" type="password" placeholder="Kamida 8 ta belgi" {...register("password")} />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>

            {/* Org fields — animated in/out */}
            <AnimatePresence>
              {isOrgAdmin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <Separator className="my-2" />
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                      <Building2 className="h-4 w-4" />
                      Tashkilot ma&apos;lumotlari
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org_name">Tashkilot nomi *</Label>
                      <Input id="org_name" placeholder="Masalan: 15-maktab" {...register("org_name")} />
                      {errors.org_name && <p className="text-sm text-red-500">{errors.org_name.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org_type">Tashkilot turi *</Label>
                      <select
                        id="org_type"
                        {...register("org_type")}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {orgTypeLabels.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      {errors.org_type && <p className="text-sm text-red-500">{errors.org_type.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org_responsible">Mas&apos;ul shaxs</Label>
                      <Input id="org_responsible" placeholder="F.I.O." {...register("org_responsible")} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="org_phone">Telefon</Label>
                        <Input id="org_phone" placeholder="+998 90 123 45 67" {...register("org_phone")} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="org_stir">STIR</Label>
                        <Input id="org_stir" placeholder="123456789" {...register("org_stir")} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="org_address">Manzil</Label>
                      <Input id="org_address" placeholder="Viloyat, shahar, ko'cha" {...register("org_address")} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? "Yuklanmoqda..."
                : isOrgAdmin
                ? "Ro'yxatdan o'tish va so'rov yuborish"
                : "Ro'yxatdan o'tish"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Hisobingiz bormi?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Tizimga kirish
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
