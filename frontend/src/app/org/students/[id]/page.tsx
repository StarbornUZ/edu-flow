"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, GraduationCap, Zap, Flame, Star, BarChart2, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  xp: number;
  level: number;
  streak_count: number;
  created_at: string;
  classes: { id: string; name: string; academic_year: string; grade_level: number | null }[];
  courses: { id: string; title: string; subject: string; status: string }[];
  stats: { classes_count: number; courses_count: number; xp: number; level: number; streak_count: number };
}

function PasswordPanel({ userId, orgId }: { userId: string; orgId: string }) {
  const [show, setShow] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [creds, setCreds] = useState<{ system_password: string | null } | null>(null);

  const load = async () => {
    if (creds !== null) { setShow((v) => !v); return; }
    try {
      const { data } = await api.get<{ system_password: string | null }>(
        `/organizations/${orgId}/members/${userId}/credentials`
      );
      setCreds(data);
      setShow(true);
    } catch {
      toast.error("Ma'lumotni yuklashda xatolik");
    }
  };

  const resetPassword = async () => {
    setResetting(true);
    try {
      const { data } = await api.post<{ new_password: string }>(
        `/organizations/${orgId}/members/${userId}/reset-password`
      );
      setCreds({ system_password: data.new_password });
      setShow(true);
      toast.success("Parol tiklandi");
    } catch {
      toast.error("Parolni tiklashda xatolik");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {show && creds?.system_password ? (
        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{creds.system_password}</span>
      ) : (
        <span className="text-sm text-muted-foreground">
          {creds !== null && creds.system_password === null ? "Foydalanuvchi o'zgartirgan" : "••••••••"}
        </span>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetPassword} disabled={resetting}>
        <RefreshCw className={`h-4 w-4 ${resetting ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

export default function StudentProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;

  const { data: profile, isLoading } = useQuery<StudentProfile>({
    queryKey: ["student-profile", orgId, id],
    queryFn: () =>
      api.get<StudentProfile>(`/organizations/${orgId}/members/${id}/profile`).then((r) => r.data),
    enabled: !!orgId && !!id,
  });

  if (!orgId) return null;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        O&apos;quvchi topilmadi.
        <Button variant="link" onClick={() => router.back()}>Orqaga</Button>
      </div>
    );
  }

  const initials = profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Orqaga
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{profile.full_name}</h1>
                <Badge variant="secondary">O&apos;quvchi</Badge>
              </div>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {profile.username && (
                  <p>Username: <span className="font-mono text-foreground">{profile.username}</span></p>
                )}
                <p>Email: {profile.email}</p>
                {profile.phone && <p>Tel: {profile.phone}</p>}
                <p>Ro&apos;yxatdan o&apos;tgan: {new Date(profile.created_at).toLocaleDateString("uz-UZ")}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-1">Tizim paroli</p>
            <PasswordPanel userId={profile.id} orgId={orgId} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Zap className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{profile.stats.xp}</p>
            <p className="text-sm text-muted-foreground">XP</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Star className="h-6 w-6 mx-auto text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{profile.stats.level}</p>
            <p className="text-sm text-muted-foreground">Daraja</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Flame className="h-6 w-6 mx-auto text-orange-500 mb-2" />
            <p className="text-2xl font-bold">{profile.stats.streak_count}</p>
            <p className="text-sm text-muted-foreground">Streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-6 w-6 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{profile.stats.courses_count}</p>
            <p className="text-sm text-muted-foreground">Kurslar</p>
          </CardContent>
        </Card>
      </div>

      {/* Classes */}
      {profile.classes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Sinflari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profile.classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{cls.name}</p>
                    <p className="text-xs text-muted-foreground">{cls.academic_year}</p>
                  </div>
                  {cls.grade_level && (
                    <Badge variant="outline">{cls.grade_level}-sinf</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Courses */}
      {profile.courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Kurslari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profile.courses.map((course) => (
                <div key={course.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{course.title}</p>
                    <p className="text-xs text-muted-foreground">{course.subject}</p>
                  </div>
                  <Badge variant={course.status === "published" ? "default" : "secondary"}>
                    {course.status === "published" ? "Nashr etilgan" : course.status === "draft" ? "Qoralama" : "Arxivlangan"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {profile.classes.length === 0 && profile.courses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Hali sinf yoki kursga yozilmagan</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
