"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, roleRoutes } from "@/stores/auth.store";

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) {
      const route = roleRoutes[user.role] || "/login";
      router.replace(route);
    } else {
      router.replace("/login");
    }
  }, [user, router]);

  return null;
}
