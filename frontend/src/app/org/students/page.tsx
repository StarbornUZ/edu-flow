"use client";

import { useState } from "react";
import { Plus, GraduationCap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { User } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  const { data: students, isLoading } = useQuery<User[]>({
    queryKey: ["org-students"],
    queryFn: () =>
      api.get<User[]>("/org/members", { params: { role: "student" } }).then((r) => r.data),
  });

  const invite = useMutation({
    mutationFn: (inviteEmail: string) =>
      api.post("/org/members/invite", { email: inviteEmail, role: "student" }),
    onSuccess: () => {
      toast.success("O'quvchi muvaffaqiyatli taklif qilindi");
      queryClient.invalidateQueries({ queryKey: ["org-students"] });
      setEmail("");
      setOpen(false);
    },
    onError: () => {
      toast.error("Xatolik yuz berdi. Qayta urinib ko'ring.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    invite.mutate(email.trim());
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">O&apos;quvchilar ro&apos;yxati</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              O&apos;quvchi qo&apos;shish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>O&apos;quvchi taklif qilish</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={invite.isPending}>
                {invite.isPending ? "Yuborilmoqda..." : "Taklif yuborish"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="rounded-lg border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
                <Skeleton className="h-5 w-1/5" />
              </div>
            ))}
          </div>
        </div>
      ) : students && students.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To&apos;liq ism</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Daraja</TableHead>
                <TableHead>XP</TableHead>
                <TableHead>Qo&apos;shilgan sana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    {student.full_name}
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.phone ?? "---"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {student.level}-daraja
                    </Badge>
                  </TableCell>
                  <TableCell>{student.xp} XP</TableCell>
                  <TableCell>{formatDate(student.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            Hali o&apos;quvchilar yo&apos;q
          </h3>
          <p className="text-muted-foreground mb-4">
            Birinchi o&apos;quvchini taklif qiling
          </p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            O&apos;quvchi qo&apos;shish
          </Button>
        </div>
      )}
    </div>
  );
}
