"use client";

import { useState } from "react";
import { Plus, BookMarked, Globe, Building2, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { Subject } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;

  // Create state
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: subjects, isLoading } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => api.get<Subject[]>("/subjects/").then((r) => r.data),
  });

  const createSubject = useMutation({
    mutationFn: () =>
      api.post<Subject>("/subjects/", {
        name: name.trim(),
        icon: icon.trim() || null,
        description: description.trim() || null,
        org_id: orgId,
      }),
    onSuccess: () => {
      toast.success("Fan muvaffaqiyatli yaratildi");
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setOpen(false);
      setName(""); setIcon(""); setDescription("");
    },
    onError: () => toast.error("Fan yaratishda xatolik"),
  });

  const updateSubject = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/subjects/${id}`, {
        name: editName.trim(),
        icon: editIcon.trim() || null,
        description: editDescription.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Fan yangilandi");
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setEditOpen(false);
      setEditSubject(null);
    },
    onError: () => toast.error("Yangilashda xatolik"),
  });

  const deleteSubject = useMutation({
    mutationFn: (id: string) => api.delete(`/subjects/${id}`),
    onSuccess: () => {
      toast.success("Fan o'chirildi");
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setDeleteConfirmId(null);
    },
    onError: () => toast.error("O'chirishda xatolik"),
  });

  const openEdit = (s: Subject) => {
    setEditSubject(s);
    setEditName(s.name);
    setEditIcon(s.icon ?? "");
    setEditDescription(s.description ?? "");
    setEditOpen(true);
  };

  const defaultSubjects = subjects?.filter((s) => s.is_default) ?? [];
  const orgSubjects = subjects?.filter((s) => !s.is_default && s.org_id === orgId) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fanlar</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Fan qo&apos;shish
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Yangi fan yaratish</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Fan nomi *</Label>
                <Input placeholder="Masalan: Robototexnika" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Emoji belgisi (ixtiyoriy)</Label>
                <Input placeholder="🤖" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
              </div>
              <div className="space-y-2">
                <Label>Tavsif (ixtiyoriy)</Label>
                <Input placeholder="Fan haqida qisqacha..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => createSubject.mutate()} disabled={createSubject.isPending || !name.trim()}>
                {createSubject.isPending ? "Yaratilmoqda..." : "Yaratish"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditSubject(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Fanni tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fan nomi *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Emoji belgisi (ixtiyoriy)</Label>
              <Input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} maxLength={4} />
            </div>
            <div className="space-y-2">
              <Label>Tavsif (ixtiyoriy)</Label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => editSubject && updateSubject.mutate(editSubject.id)}
              disabled={updateSubject.isPending || !editName.trim()}
            >
              {updateSubject.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Fanni o&apos;chirish</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bu fanni o&apos;chirishni tasdiqlaysizmi? Bu amal qaytarib bo&apos;lmaydi.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Bekor qilish</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteSubject.mutate(deleteConfirmId)}
              disabled={deleteSubject.isPending}
            >
              {deleteSubject.isPending ? "O'chirilmoqda..." : "O'chirish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Org-specific subjects */}
          {orgSubjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Tashkilot fanlari
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {orgSubjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-background p-3 relative group">
                    {s.icon && <span className="text-xl leading-none">{s.icon}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">Tashkilot</Badge>
                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(s.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Default (global) subjects */}
          {defaultSubjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Globe className="h-4 w-4" />
                Standart fanlar
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {defaultSubjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    {s.icon && <span className="text-xl leading-none">{s.icon}</span>}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!subjects?.length && (
            <div className="text-center py-16">
              <BookMarked className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Hali fan yo&apos;q</h3>
              <p className="text-muted-foreground">Yuqoridagi tugma orqali fan qo&apos;shing</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
