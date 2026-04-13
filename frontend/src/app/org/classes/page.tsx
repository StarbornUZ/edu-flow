"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, School } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Class } from "@/types";
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

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    grade_level: "",
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sinflar ro&apos;yxati</h1>
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
                <TableRow
                  key={cls.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/org/classes/${cls.id}`)}
                >
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
