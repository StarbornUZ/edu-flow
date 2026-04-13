"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, GraduationCap, Search, UserPlus, Eye, EyeOff, RefreshCw, Copy, X, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { User, Class, CreatedMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface OrgInvitation {
  id: string;
  invited_user_name: string;
  invited_user_email: string;
  role_in_org: string;
  status: string;
  created_at: string;
}

function PasswordCell({ userId, orgId }: { userId: string; orgId: string }) {
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
    <div className="flex items-center gap-1">
      {show && creds?.system_password ? (
        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{creds.system_password}</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {creds !== null && creds.system_password === null ? "O'zgartirilgan" : "••••••••"}
        </span>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={load}>
        {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetPassword} disabled={resetting}>
        <RefreshCw className={`h-3 w-3 ${resetting ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

function CredentialsCard({ member, classes, onClose }: {
  member: CreatedMember;
  classes: Class[];
  onClose: () => void;
}) {
  const [classId, setClassId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Nusxalandi"); };

  const assignToClass = async () => {
    if (!classId) return;
    setAssigning(true);
    try {
      await api.post(`/classes/${classId}/students`, { student_id: member.id });
      toast.success("O'quvchi sinfga qo'shildi");
      setClassId("");
    } catch {
      toast.error("Sinfga qo'shishda xatolik");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
        <p className="text-sm font-medium text-green-800">O&apos;quvchi muvaffaqiyatli yaratildi!</p>
        <div className="space-y-2 text-sm">
          {[
            { label: "Ism", value: member.full_name },
            { label: "Username", value: member.username },
            { label: "Email", value: member.email },
            { label: "Parol", value: member.generated_password },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{label}:</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs">{value}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copy(value)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Bu ma&apos;lumotlarni saqlang!
        </p>
      </div>

      {classes.length > 0 && (
        <div className="space-y-2">
          <Label>Sinfga biriktirish (ixtiyoriy)</Label>
          <div className="flex gap-2">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sinf tanlang" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={assignToClass} disabled={assigning || !classId}>
              {assigning ? "..." : "Qo'shish"}
            </Button>
          </div>
        </div>
      )}

      <Button className="w-full" onClick={onClose}>Yopish</Button>
    </div>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.org_id;
  const [open, setOpen] = useState(false);
  const [createdMember, setCreatedMember] = useState<CreatedMember | null>(null);

  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<User | null | "not_found">(null);
  const [searching, setSearching] = useState(false);
  const [fullName, setFullName] = useState("");

  const { data: students, isLoading } = useQuery<User[]>({
    queryKey: ["org-students", orgId],
    queryFn: () =>
      api.get<User[]>(`/organizations/${orgId}/members`).then((r) =>
        r.data.filter((m) => m.role === "student")
      ),
    enabled: !!orgId,
  });

  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ["org-classes"],
    queryFn: () => api.get<Class[]>("/classes/").then((r) => r.data),
    enabled: !!orgId,
  });

  const { data: pendingInvitations } = useQuery<OrgInvitation[]>({
    queryKey: ["org-invitations-students", orgId],
    queryFn: () =>
      api.get<OrgInvitation[]>(`/organizations/${orgId}/invitations?status=pending`).then((r) =>
        r.data.filter((inv) => inv.role_in_org === "student")
      ),
    enabled: !!orgId,
  });

  const addExisting = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/organizations/${orgId}/invitations`, { user_id: userId, role_in_org: "student" }),
    onSuccess: () => {
      toast.success("Ta'klif yuborildi");
      queryClient.invalidateQueries({ queryKey: ["org-invitations-students", orgId] });
      closeDialog();
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  const revokeInvitation = useMutation({
    mutationFn: (invId: string) =>
      api.delete(`/organizations/${orgId}/invitations/${invId}`),
    onSuccess: () => {
      toast.success("Taklif bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ["org-invitations-students", orgId] });
    },
    onError: () => toast.error("Bekor qilishda xatolik"),
  });

  const createAndAdd = useMutation({
    mutationFn: (name: string) =>
      api.post<CreatedMember>(`/organizations/${orgId}/users`, { full_name: name, role_in_org: "student" }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ["org-students", orgId] });
      setCreatedMember(data);
      setFullName("");
    },
    onError: () => toast.error("O'quvchi yaratishda xatolik"),
  });

  const handleSearch = async () => {
    if (!searchEmail.trim() || !orgId) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const { data } = await api.get<User[]>(
        `/organizations/${orgId}/users/search?email=${encodeURIComponent(searchEmail)}&role=student`
      );
      setSearchResult(data.length > 0 ? data[0] : "not_found");
    } catch {
      toast.error("Qidirishda xatolik");
    } finally {
      setSearching(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setCreatedMember(null);
    setSearchEmail("");
    setSearchResult(null);
    setFullName("");
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "numeric" });

  if (!orgId) {
    return <div className="text-center py-16 text-muted-foreground">Tashkilot ma&apos;lumotlari yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">O&apos;quvchilar ro&apos;yxati</h1>
        <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />O&apos;quvchi qo&apos;shish</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>O&apos;quvchi qo&apos;shish</DialogTitle></DialogHeader>

            {createdMember ? (
              <CredentialsCard member={createdMember} classes={classes} onClose={closeDialog} />
            ) : (
              <Tabs defaultValue="create">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="create"><UserPlus className="h-4 w-4 mr-2" />Yangi yaratish</TabsTrigger>
                  <TabsTrigger value="search"><Search className="h-4 w-4 mr-2" />Mavjudni qidirish</TabsTrigger>
                </TabsList>

                <TabsContent value="create" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Faqat ism kiriting — tizim avtomatik username va parol yaratadi.
                  </p>
                  <div className="space-y-2">
                    <Label>To&apos;liq ism *</Label>
                    <Input
                      placeholder="Ism Familiya"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fullName.trim() && createAndAdd.mutate(fullName.trim())}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createAndAdd.mutate(fullName.trim())}
                    disabled={createAndAdd.isPending || !fullName.trim()}
                  >
                    {createAndAdd.isPending ? "Yaratilmoqda..." : "Yaratish"}
                  </Button>
                </TabsContent>

                <TabsContent value="search" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Email bo&apos;yicha qidirish</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="student@example.com"
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <Button variant="secondary" onClick={handleSearch} disabled={searching}>
                        {searching ? "..." : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {searchResult === "not_found" && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Topilmadi. &ldquo;Yangi yaratish&rdquo; yorlig&apos;idan foydalaning.
                    </p>
                  )}
                  {searchResult && searchResult !== "not_found" && (
                    <div className="rounded-lg border p-3 space-y-3">
                      <div>
                        <p className="font-medium">{searchResult.full_name}</p>
                        <p className="text-sm text-muted-foreground">{searchResult.email}</p>
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => addExisting.mutate((searchResult as User).id)}
                        disabled={addExisting.isPending}
                      >
                        {addExisting.isPending ? "Yuborilmoqda..." : "Ta'klif yuborish"}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-5 flex-1" /><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 flex-1" />
            </div>
          ))}
        </div>
      ) : students && students.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To&apos;liq ism</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tizim paroli</TableHead>
                <TableHead>Daraja</TableHead>
                <TableHead>Sana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/org/students/${s.id}`)}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>
                    {s.username
                      ? <Badge variant="outline" className="font-mono text-xs">{s.username}</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{s.email}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}><PasswordCell userId={s.id} orgId={orgId} /></TableCell>
                  <TableCell><Badge variant="secondary">{s.level}-daraja</Badge></TableCell>
                  <TableCell className="text-sm">{formatDate(s.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Hali o&apos;quvchilar yo&apos;q</h3>
          <p className="text-muted-foreground">Yuqoridagi tugma orqali o&apos;quvchi qo&apos;shing</p>
        </div>
      )}

      {/* Pending invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Kutilayotgan takliflar</h2>
            <Badge variant="secondary">{pendingInvitations.length}</Badge>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To&apos;liq ism</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Yuborilgan sana</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invited_user_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.invited_user_email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(inv.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => revokeInvitation.mutate(inv.id)}
                        disabled={revokeInvitation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
