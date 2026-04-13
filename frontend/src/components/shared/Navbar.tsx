"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, User, BookOpen, Bell, CheckCircle, XCircle, Swords } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import type { Notification } from "@/types";

const roleBadgeColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  org_admin: "bg-purple-100 text-purple-700 border-purple-200",
  teacher: "bg-blue-100 text-blue-700 border-blue-200",
  student: "bg-green-100 text-green-700 border-green-200",
  parent: "bg-orange-100 text-orange-700 border-orange-200",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  org_admin: "Org Admin",
  teacher: "O'qituvchi",
  student: "O'quvchi",
  parent: "Ota-ona",
};

const roleLabelMap: Record<string, string> = {
  teacher: "O'qituvchi",
  student: "O'quvchi",
  parent: "Ota-ona",
};

interface Invitation {
  id: string;
  org_name: string;
  role_in_org: string;
  message: string | null;
  created_at: string;
}

function InvitationBell() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: invitations } = useQuery<Invitation[]>({
    queryKey: ["my-invitations"],
    queryFn: () => api.get<Invitation[]>("/users/me/invitations").then((r) => r.data),
    enabled: !!user && user.role !== "admin",
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get<Notification[]>("/notifications").then((r) => r.data),
    enabled: !!user && user.role === "student",
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/users/me/invitations/${id}/accept`),
    onSuccess: () => {
      toast.success("Taklif qabul qilindi. Tashkilotga qo'shildingiz!");
      queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      window.location.reload();
    },
    onError: () => toast.error("Qabul qilishda xatolik"),
  });

  const decline = useMutation({
    mutationFn: (id: string) => api.post(`/users/me/invitations/${id}/decline`),
    onSuccess: () => {
      toast.success("Taklif rad etildi");
      queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
    },
    onError: () => toast.error("Rad etishda xatolik"),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!user || user.role === "admin") return null;

  const invCount = invitations?.length ?? 0;
  const unreadNotifs = (notifications ?? []).filter((n) => !n.is_read);
  const liveInvites = unreadNotifs.filter((n) => n.type === "live_session_invite");
  const totalCount = invCount + liveInvites.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {totalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Bildirishnomalar</p>
        </div>

        {totalCount === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Yangi bildirishnoma yo&apos;q
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y">
            {/* Live session invites */}
            {liveInvites.map((notif) => {
              const sessionId = notif.data?.session_id as string | undefined;
              return (
                <div key={notif.id} className="px-4 py-3 space-y-2 bg-blue-50/50">
                  <div className="flex items-start gap-2">
                    <Swords className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notif.title}</p>
                      {notif.body && (
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                      )}
                    </div>
                  </div>
                  {sessionId && (
                    <Button
                      asChild
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => markRead.mutate(notif.id)}
                    >
                      <Link href={`/student/live/${sessionId}`}>
                        Musobaqaga kirish
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}

            {/* Org invitations */}
            {invitations?.map((inv) => (
              <div key={inv.id} className="px-4 py-3 space-y-2">
                <div>
                  <p className="text-sm font-medium">{inv.org_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Rol: {roleLabelMap[inv.role_in_org] ?? inv.role_in_org}
                  </p>
                  {inv.message && (
                    <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{inv.message}&rdquo;</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(inv.created_at).toLocaleDateString("uz-UZ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => accept.mutate(inv.id)}
                    disabled={accept.isPending || decline.isPending}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Qabul
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    onClick={() => decline.mutate(inv.id)}
                    disabled={accept.isPending || decline.isPending}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Rad etish
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Navbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
            EduFlow
          </span>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium hidden sm:inline">{user.full_name}</span>
                <Badge variant="outline" className={roleBadgeColors[user.role] || ""}>
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
              <InvitationBell />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Chiqish</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
