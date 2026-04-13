"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import type { User } from "@/types";

function AuthSync() {
  const { access_token, updateUser } = useAuthStore();

  useEffect(() => {
    if (!access_token) return;
    // Refresh user from server so org_id / username / role are always current
    api.get<User>("/auth/me")
      .then((r) => updateUser(r.data))
      .catch(() => {
        // Refresh ham muvaffaqiyatsiz bo'lsa interceptor logout() chaqiradi.
        // Agar interceptor ishlamasa (masalan, network xatosi), storedan faqat
        // user ni tozalaymiz — bu yerda tokenni emas, chunki interceptor handles it.
      });
  }, [access_token, updateUser]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
