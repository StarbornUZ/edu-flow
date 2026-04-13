"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Search, UserPlus, Eye, EyeOff, RefreshCw, Copy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { User, CreatedMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function PasswordCell({ userId, orgId }: { userId: string; orgId: string }) {
  const [show, setShow] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [creds, setCreds] = useState<{ system_password: string | null; username: string | null } | null>(null);

  const load = async () => {
    if (creds !== null) { setShow((v) => !v); return; }
    try {
      const { data } = await api.get<{ system_password: string | null; username: string | null }>(
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
      const { data } = await api.post<{ new_password: string; username: string }>(
        `/organizations/${orgId}/members/${userId}/reset-password`
      );
      setCreds({ system_password: data.new_password, username: data.username });
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

function CredentialsCard({ member, onClose }: { member: CreatedMember; onClose: () => void }) {
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Nusxalandi"); };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
        <p className="text-sm font-medium text-green-800">O&apos;qituvchi muvaffaqiyatli yaratildi!</p>
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
          Bu ma&apos;lumotlarni saqlang! O&apos;qituvchi parolini o&apos;zgartirsa, tizim paroli ko&apos;rinmaydi.
        </p>
      </div>
      <Button className="w-full" onClick={onClose}>Yopish</Button>
    </div>
  );
}

export default function TeachersPage() {
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

  const { data: teachers, isLoading } = useQuery<User[]>({
    queryKey: ["org-teachers", orgId],
    queryFn: () =>
      api.get<User[]>(`/organizations/${orgId}/members`).then((r) =>
        r.data.filter((m) => m.role === "teacher")
      ),
    enabled: !!orgId,
  });

  const addExisting = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/organizations/${orgId}/members`, { user_id: userId, role_in_org: "teacher" }),
    onSuccess: () => {
      toast.success("O'qituvchi muvaffaqiyatli qo'shildi");
      queryClient.invalidateQueries({ queryKey: ["org-teachers", orgId] });
      closeDialog();
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  const createAndAdd = useMutation({
    mutationFn: (name: string) =>
      api.post<CreatedMember>(`/organizations/${orgId}/users`, { full_name: name, role_in_org: "teacher" }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ["org-teachers", orgId] });
      setCreatedMember(data);
      setFullName("");
    },
    onError: () => toast.error("O'qituvchi yaratishda xatolik"),
  });

  const handleSearch = async () => {
    if (!searchEmail.trim() || !orgId) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const { data } = await api.get<User[]>(
        `/organizations/${orgId}/users/search?email=${encodeURIComponent(searchEmail)}&role=teacher`
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
        <h1 className="text-2xl font-bold">O&apos;qituvchilar ro&apos;yxati</h1>
        <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />O&apos;qituvchi qo&apos;shish</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>O&apos;qituvchi qo&apos;shish</DialogTitle></DialogHeader>

            {createdMember ? (
              <CredentialsCard member={createdMember} onClose={closeDialog} />
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
                        placeholder="teacher@example.com"
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
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="font-medium">{searchResult.full_name}</p>
                      <p className="text-sm text-muted-foreground">{searchResult.email}</p>
                      <Button className="w-full" onClick={() => addExisting.mutate((searchResult as User).id)} disabled={addExisting.isPending}>
                        {addExisting.isPending ? "Qo'shilmoqda..." : "Tashkilotga qo'shish"}
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
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4"><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 flex-1" /><Skeleton className="h-5 flex-1" /></div>
          ))}
        </div>
      ) : teachers && teachers.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To&apos;liq ism</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tizim paroli</TableHead>
                <TableHead>Sana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/org/teachers/${t.id}`)}>
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell>
                    {t.username
                      ? <Badge variant="outline" className="font-mono text-xs">{t.username}</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">{t.email}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}><PasswordCell userId={t.id} orgId={orgId} /></TableCell>
                  <TableCell className="text-sm">{formatDate(t.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Hali o&apos;qituvchilar yo&apos;q</h3>
          <p className="text-muted-foreground">Yuqoridagi tugma orqali o&apos;qituvchi qo&apos;shing</p>
        </div>
      )}
    </div>
  );
}
