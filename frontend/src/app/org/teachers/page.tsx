"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { User } from "@/types";
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

export default function TeachersPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");

  const { data: allMembers, isLoading } = useQuery<User[]>({
    queryKey: ["org-members", orgId],
    queryFn: () =>
      api.get<User[]>(`/organizations/${orgId}/members`).then((r) => r.data),
    enabled: !!orgId,
  });

  const teachers = allMembers?.filter((m) => m.role === "teacher");

  const invite = useMutation({
    mutationFn: (memberId: string) =>
      api.post(`/organizations/${orgId}/members`, { user_id: memberId, role_in_org: "teacher" }),
    onSuccess: () => {
      toast.success("O'qituvchi muvaffaqiyatli qo'shildi");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
      setUserId("");
      setOpen(false);
    },
    onError: () => {
      toast.error("Xatolik yuz berdi. Qayta urinib ko'ring.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    invite.mutate(userId.trim());
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
        <h1 className="text-2xl font-bold">O&apos;qituvchilar ro&apos;yxati</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              O&apos;qituvchi qo&apos;shish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>O&apos;qituvchi qo&apos;shish</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">Foydalanuvchi ID</Label>
                <Input
                  id="userId"
                  type="text"
                  placeholder="Foydalanuvchi ID kiriting"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={invite.isPending}>
                {invite.isPending ? "Qo'shilmoqda..." : "Qo'shish"}
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
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
              </div>
            ))}
          </div>
        </div>
      ) : teachers && teachers.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To&apos;liq ism</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Qo&apos;shilgan sana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">
                    {teacher.full_name}
                  </TableCell>
                  <TableCell>{teacher.email}</TableCell>
                  <TableCell>{teacher.phone ?? "---"}</TableCell>
                  <TableCell>{formatDate(teacher.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            Hali o&apos;qituvchilar yo&apos;q
          </h3>
          <p className="text-muted-foreground mb-4">
            Birinchi o&apos;qituvchini taklif qiling
          </p>
          <Button onClick={() => setOpen(true)} disabled={!orgId}>
            <Plus className="h-4 w-4 mr-2" />
            O&apos;qituvchi qo&apos;shish
          </Button>
        </div>
      )}
    </div>
  );
}
