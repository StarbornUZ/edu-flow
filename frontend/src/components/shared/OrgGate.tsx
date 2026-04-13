"use client";

import { Building2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";

const GATED_ROLES = ["teacher", "student", "parent"];

export default function OrgGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (user && GATED_ROLES.includes(user.role) && !user.org_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-orange-100 p-6">
              <Building2 className="h-12 w-12 text-orange-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Tashkilotga ulanmadingiz</h1>
            <p className="text-muted-foreground">
              Siz hali hech qanday tashkilotga qo&apos;shilmadingiz. Tashkilot adminiga
              murojaat qilib, sizni platformaga qo&apos;shishini so&apos;rang.
            </p>
          </div>
          <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
            Agar allaqachon taklif kutayotgan bo&apos;lsangiz, tashkilot adminiga
            taklifni tasdiqlashini so&apos;rang.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Chiqish
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
