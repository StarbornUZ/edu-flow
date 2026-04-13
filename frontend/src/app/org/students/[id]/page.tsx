"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, GraduationCap, Zap, Flame, Star, BarChart2, Eye, EyeOff, RefreshCw, UserPlus, Trash2, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { StudentParent } from "@/types";

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

function ParentSection({ studentId, orgId }: { studentId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [searchResult, setSearchResult] = useState<StudentParent | "not_found" | null>(null);
  const [searching, setSearching] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ password: string; username: string } | null>(null);

  const { data: parents, isLoading } = useQuery<StudentParent[]>({
    queryKey: ["student-parents", orgId, studentId],
    queryFn: () =>
      api.get<StudentParent[]>(`/organizations/${orgId}/students/${studentId}/parents`).then((r) => r.data),
  });

  const assignParent = useMutation({
    mutationFn: (body: { email: string; full_name?: string }) =>
      api.post<StudentParent & { generated_password?: string }>(
        `/organizations/${orgId}/students/${studentId}/parents`,
        body
      ),
    onSuccess: (res) => {
      toast.success("Ota-ona biriktirildi");
      queryClient.invalidateQueries({ queryKey: ["student-parents", orgId, studentId] });
      if (res.data.generated_password) {
        setNewCredentials({ password: res.data.generated_password, username: res.data.username ?? "" });
      } else {
        setDialogOpen(false);
        setEmail(""); setFullName(""); setSearchResult(null);
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Biriktirishda xatolik");
    },
  });

  const removeParent = useMutation({
    mutationFn: (parentId: string) =>
      api.delete(`/organizations/${orgId}/students/${studentId}/parents/${parentId}`),
    onSuccess: () => {
      toast.success("Ota-ona olib tashlandi");
      queryClient.invalidateQueries({ queryKey: ["student-parents", orgId, studentId] });
    },
    onError: () => toast.error("O'chirishda xatolik"),
  });

  const handleSearch = async () => {
    if (!email.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const { data } = await api.get<{ id: string; full_name: string; email: string; username: string | null }[]>(
        `/organizations/${orgId}/users/search?email=${encodeURIComponent(email)}&role=parent`
      );
      setSearchResult(data.length > 0 ? (data[0] as StudentParent) : "not_found");
    } catch {
      toast.error("Qidirishda xatolik");
    } finally {
      setSearching(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEmail(""); setFullName(""); setSearchResult(null); setNewCredentials(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ota-ona
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                Biriktirish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ota-ona biriktirish</DialogTitle>
              </DialogHeader>
              {newCredentials ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Yangi ota-ona yaratildi. Login ma'lumotlari:</p>
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1 font-mono text-sm">
                    <p>Username: <span className="font-semibold">{newCredentials.username}</span></p>
                    <p>Parol: <span className="font-semibold">{newCredentials.password}</span></p>
                  </div>
                  <Button className="w-full" onClick={closeDialog}>Yopish</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Email orqali qidirish</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="parent@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setSearchResult(null); }}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <Button variant="secondary" onClick={handleSearch} disabled={searching || !email.trim()}>
                        {searching ? "..." : "Qidirish"}
                      </Button>
                    </div>
                  </div>

                  {searchResult && searchResult !== "not_found" && (
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="font-medium">{(searchResult as StudentParent).full_name}</p>
                      <p className="text-sm text-muted-foreground">{(searchResult as StudentParent).email}</p>
                      <Button
                        className="w-full"
                        onClick={() => assignParent.mutate({ email })}
                        disabled={assignParent.isPending}
                      >
                        {assignParent.isPending ? "Biriktirilmoqda..." : "Biriktirish"}
                      </Button>
                    </div>
                  )}

                  {searchResult === "not_found" && (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-sm text-muted-foreground">Topilmadi. Yangi ota-ona yarating:</p>
                      <div className="space-y-1">
                        <Label>To&apos;liq ismi *</Label>
                        <Input
                          placeholder="Abdullayev Sardor"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => assignParent.mutate({ email, full_name: fullName })}
                        disabled={assignParent.isPending || !fullName.trim()}
                      >
                        {assignParent.isPending ? "Yaratilmoqda..." : "Yaratib biriktirish"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : parents && parents.length > 0 ? (
          <div className="space-y-2">
            {parents.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                  {p.username && <p className="text-xs text-muted-foreground font-mono">{p.username}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.is_confirmed ? "default" : "outline"}>
                    {p.is_confirmed ? "Tasdiqlangan" : "Tasdiqlanmagan"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeParent.mutate(p.id)}
                    disabled={removeParent.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Hali ota-ona biriktirilmagan
          </p>
        )}
      </CardContent>
    </Card>
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

      <ParentSection studentId={profile.id} orgId={orgId} />
    </div>
  );
}
