"use client";

import { useState } from "react";
import { Plus, School, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Class, User } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;

  // Create class dialog
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    grade_level: "",
  });

  // Assign student dialog
  const [openAssign, setOpenAssign] = useState(false);
  const [assignClassId, setAssignClassId] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentResult, setStudentResult] = useState<User | null | "not_found">(null);
  const [searchingStudent, setSearchingStudent] = useState(false);

  const { data: classes, isLoading } = useQuery<Class[]>({
    queryKey: ["org-classes"],
    queryFn: () => api.get<Class[]>("/classes/").then((r) => r.data),
    enabled: !!orgId,
  });

  const createClass = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: form.name,
        academic_year: form.academic_year,
      };
      if (form.grade_level) body.grade_level = Number(form.grade_level);
      return api.post("/classes/", body);
    },
    onSuccess: () => {
      toast.success("Sinf muvaffaqiyatli yaratildi");
      queryClient.invalidateQueries({ queryKey: ["org-classes"] });
      setOpenCreate(false);
      setForm({ name: "", academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, grade_level: "" });
    },
    onError: () => toast.error("Sinf yaratishda xatolik yuz berdi"),
  });

  const assignStudent = useMutation({
    mutationFn: (studentId: string) =>
      api.post(`/classes/${assignClassId}/students`, { student_id: studentId }),
    onSuccess: () => {
      toast.success("O'quvchi sinfga qo'shildi");
      setStudentEmail("");
      setStudentResult(null);
      setOpenAssign(false);
    },
    onError: () => toast.error("O'quvchi qo'shishda xatolik. U allaqachon bu sinfda bo'lishi mumkin."),
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
      toast.error("Qidirishda xatolik yuz berdi");
    } finally {
      setSearchingStudent(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sinflar ro&apos;yxati</h1>
        <div className="flex gap-2">
          {/* Assign student to class */}
          <Dialog open={openAssign} onOpenChange={(v) => { setOpenAssign(v); setStudentEmail(""); setStudentResult(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!classes?.length}>
                <Users className="h-4 w-4 mr-2" />
                O&apos;quvchi biriktirish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Sinfga o&apos;quvchi biriktirish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Sinf</Label>
                  <Select value={assignClassId} onValueChange={setAssignClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sinf tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.academic_year})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>O&apos;quvchini email bo&apos;yicha qidiring</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="student@example.com"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchStudent()}
                    />
                    <Button variant="secondary" onClick={handleSearchStudent} disabled={searchingStudent || !assignClassId}>
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
                    <p className="font-medium">{studentResult.full_name}</p>
                    <p className="text-sm text-muted-foreground">{studentResult.email}</p>
                    <Button
                      className="w-full"
                      onClick={() => assignStudent.mutate((studentResult as User).id)}
                      disabled={assignStudent.isPending || !assignClassId}
                    >
                      {assignStudent.isPending ? "Qo'shilmoqda..." : "Sinfga qo'shish"}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Create class */}
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Sinf yaratish
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Yangi sinf yaratish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Sinf nomi *</Label>
                  <Input
                    placeholder="Masalan: 9A, Matematika guruhi"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>O&apos;quv yili *</Label>
                  <Input
                    placeholder="2025-2026"
                    value={form.academic_year}
                    onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Sinf raqami</Label>
                  <Input
                    type="number"
                    placeholder="Masalan: 9"
                    value={form.grade_level}
                    onChange={(e) => setForm((f) => ({ ...f, grade_level: e.target.value }))}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createClass.mutate()}
                  disabled={createClass.isPending || !form.name || !form.academic_year}
                >
                  {createClass.isPending ? "Yaratilmoqda..." : "Sinf yaratish"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          ))}
        </div>
      ) : classes && classes.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sinf nomi</TableHead>
                <TableHead>O&apos;quv yili</TableHead>
                <TableHead>Sinf raqami</TableHead>
                <TableHead>Sinf kodi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{cls.academic_year}</TableCell>
                  <TableCell>{cls.grade_level ?? "---"}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                      {cls.class_code}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16">
          <School className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Hali sinflar yo&apos;q</h3>
          <p className="text-muted-foreground">
            Yuqoridagi &ldquo;Sinf yaratish&rdquo; tugmasi orqali sinf yarating
          </p>
        </div>
      )}
    </div>
  );
}
