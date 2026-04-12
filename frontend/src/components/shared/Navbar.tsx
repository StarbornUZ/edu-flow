"use client";

import { useRouter } from "next/navigation";
import { LogOut, User, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";

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

        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium hidden sm:inline">
                  {user.full_name}
                </span>
                <Badge
                  variant="outline"
                  className={roleBadgeColors[user.role] || ""}
                >
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-1"
              >
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
