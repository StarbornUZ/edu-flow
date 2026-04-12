"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore, roleRoutes } from "@/stores/auth.store";
import type { AuthResponse } from "@/types";

const registerSchema = z.object({
  full_name: z.string().min(2, "Ism kamida 2 ta belgidan iborat bo'lishi kerak"),
  email: z.string().email("Email formati noto'g'ri"),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak"),
  role: z.enum(["teacher", "student"], {
    message: "Rolni tanlang",
  }),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "student",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (values: RegisterForm) => {
    try {
      setError(null);
      const { data } = await api.post<AuthResponse>("/auth/register", values);
      setAuth(data.user, data.access_token, data.refresh_token);
      const route = roleRoutes[data.user.role] || "/login";
      router.push(route);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "Ro'yxatdan o'tishda xatolik yuz berdi");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md px-4"
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
          <CardDescription>
            Yangi hisob yarating
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="full_name">To&apos;liq ism</Label>
              <Input
                id="full_name"
                type="text"
                placeholder="Ismingiz"
                {...register("full_name")}
              />
              {errors.full_name && (
                <p className="text-sm text-red-500">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rolni tanlang</Label>
              <div className="flex gap-4">
                <label
                  className={`flex-1 cursor-pointer rounded-lg border-2 p-3 text-center transition-colors ${
                    selectedRole === "teacher"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    value="teacher"
                    {...register("role")}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">O&apos;qituvchi</span>
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-lg border-2 p-3 text-center transition-colors ${
                    selectedRole === "student"
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    value="student"
                    {...register("role")}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">O&apos;quvchi</span>
                </label>
              </div>
              {errors.role && (
                <p className="text-sm text-red-500">{errors.role.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Yuklanmoqda..." : "Ro'yxatdan o'tish"}
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
