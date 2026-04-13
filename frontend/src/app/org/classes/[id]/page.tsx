"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, School, Trash2, Users, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Class, User } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClassStudent {
  enrollment_id: string;
  student_id: string;
  full_name: string;
  email: string;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  enrolled_at: string;
}

export default function ClassDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;

  const [removeStudentId, setRemoveStudentId] = useState<string | null>(null);

  // Assign student state
  const [openAssign, setOpenAssign] = useState(false);
  const [studentEmail, setStudentEmail] = useState("");
  const [studentResult, setStudentResult] = useState<User | null | "not_found">(null);
  const [searchingStudent, setSearchingStudent] = useState(false);

  const { data: cls, isLoading: clsLoading } = useQuery<Class>({
    queryKey: ["class", id],
    queryFn: () => api.get<Class>(`/classes/${id}`).then((r) => r.data),
  });

  const { data: students, isLoading: studentsLoading } = useQuery<ClassStudent[]>({
    queryKey: ["class-students", id],
    queryFn: () => api.get<ClassStudent[]>(`/classes/${id}/students`).then((r) => r.data),
  });

  const assignStudent = useMutation({
    mutationFn: (studentId: string) =>
      api.post(`/classes/${id}/students`, { student_id: studentId }),
    onSuccess: () => {
      toast.success("O'quvchi sinfga qo'shildi");
      queryClient.invalidateQueries({ queryKey: ["class-students", id] });
      setStudentEmail("");
      setStudentResult(null);
      setOpenAssign(false);
    },
    onError: () => toast.error("Qo'shishda xatolik. O'quvchi allaqachon bu sinfda bo'lishi mumkin."),
  });

  const handleSearchStudent = async () => {
    if (!studentEmail.trim() || !orgId) return;
    setSearchingStudent(true);
    setStudentResult(null);
    try {
      const { data } = await api.get<User[]>(
        `/organizations/${orgId}/users/search?email=${encodeURIComponent(studentEmail)}&role=student`
      );
      setStudentResult(data.length > 0 ? data[0] : "not_found");
    } catch {
      toast.error("Qidirishda xatolik");
    } finally {
      setSearchingStudent(false);
    }
  };

  const removeStudent = useMutation({
    mutationFn: (studentId: string) =>
      api.delete(`/classes/${id}/students/${studentId}`),
    onSuccess: () => {
      toast.success("O'quvchi sinfdan chiqarildi");
      queryClient.invalidateQueries({ queryKey: ["class-students", id] });
      setRemoveStudentId(null);
    },
    onError: () => toast.error("O'chirishda xatolik yuz berdi"),
  });

  const isCodeActive = cls
    ? new Date(cls.class_code_expires_at ?? 0) > new Date()
    : false;

  const isLoading = clsLoading || studentsLoading;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Orqaga
      </Button>

      {clsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : cls ? (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{cls.name}</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                {students ? `${students.length} o'quvchi` : ""}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setOpenAssign(true); setStudentEmail(""); setStudentResult(null); }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                O&apos;quvchi biriktirish
              </Button>
            </div>
          </div>

          {/* Class info */}
          <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/20 p-4">
            <div className="text-sm">
              <span className="text-muted-foreground">O&apos;quv yili: </span>
              <span className="font-medium">{cls.academic_year}</span>
            </div>
            {cls.grade_level && (
              <div className="text-sm">
                <span className="text-muted-foreground">Sinf: </span>
                <span className="font-medium">{cls.grade_level}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sinf kodi: </span>
              <span className="font-mono font-medium bg-muted px-2 py-0.5 rounded">{cls.class_code}</span>
              <Badge variant={isCodeActive ? "default" : "outline"} className="text-xs">
                {isCodeActive ? "Aktiv" : "Muddati o'tgan"}
              </Badge>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Sinf topilmadi.</p>
      )}

      {/* Students table */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">O&apos;quvchilar ro&apos;yxati</h2>

        {isLoading ? (
          <div className="rounded-lg border p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </div>
        ) : students && students.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To&apos;liq ismi</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Qo&apos;shilgan sana</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.enrollment_id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                    <TableCell>
                      {s.username ? (
                        <span className="font-mono text-sm">{s.username}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.enrolled_at).toLocaleDateString("uz-UZ")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setRemoveStudentId(s.student_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-16">
            <School className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Hali o&apos;quvchi yo&apos;q</h3>
            <p className="text-muted-foreground">
              &ldquo;Sinflar&rdquo; sahifasidan o&apos;quvchi biriktiring
            </p>
          </div>
        )}
      </div>

      {/* Assign student dialog */}
      <Dialog open={openAssign} onOpenChange={(v) => { setOpenAssign(v); if (!v) { setStudentEmail(""); setStudentResult(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sinfga o&apos;quvchi biriktirish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>O&apos;quvchini email bo&apos;yicha qidiring</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={studentEmail}
                  onChange={(e) => { setStudentEmail(e.target.value); setStudentResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
                />
                <Button variant="secondary" onClick={handleSearchStudent} disabled={searchingStudent || !orgId}>
                  {searchingStudent ? "..." : "Qidirish"}
                </Button>
              </div>
            </div>
            {studentResult === "not_found" && (
              <p className="text-sm text-muted-foreground text-center">
                O&apos;quvchi topilmadi. Avval &ldquo;O&apos;quvchilar&rdquo; bo&apos;limida qo&apos;shing.
              </p>
            )}
            {studentResult && studentResult !== "not_found" && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="font-medium">{(studentResult as User).full_name}</p>
                <p className="text-sm text-muted-foreground">{(studentResult as User).email}</p>
                <Button
                  className="w-full"
                  onClick={() => assignStudent.mutate((studentResult as User).id)}
                  disabled={assignStudent.isPending}
                >
                  {assignStudent.isPending ? "Qo'shilmoqda..." : "Sinfga qo'shish"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirm dialog */}
      <Dialog open={!!removeStudentId} onOpenChange={(v) => { if (!v) setRemoveStudentId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>O&apos;quvchini chiqarish</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bu o&apos;quvchini sinfdan chiqarishni tasdiqlaysizmi?
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setRemoveStudentId(null)}>Bekor qilish</Button>
            <Button
              variant="destructive"
              onClick={() => removeStudentId && removeStudent.mutate(removeStudentId)}
              disabled={removeStudent.isPending}
            >
              {removeStudent.isPending ? "Chiqarilmoqda..." : "Chiqarish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
