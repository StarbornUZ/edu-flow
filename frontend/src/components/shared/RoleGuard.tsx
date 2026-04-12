"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("eduflow-auth");
    return raw ? JSON.parse(raw)?.state?.user ?? null : null;
  } catch {
    return null;
  }
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();
  const storeUser = useAuthStore((s) => s.user);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Prefer Zustand user (already hydrated) else fall back to localStorage
    const user = storeUser ?? getStoredUser();
    if (!user || !allowedRoles.includes(user.role)) {
      router.push("/login");
      setAuthorized(false);
    } else {
      setAuthorized(true);
    }
  }, [storeUser, allowedRoles, router]);

  if (authorized !== true) return null;
  return <>{children}</>;
}
