import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthStore {
  user: User | null;
  access_token: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => void;
  isAuth: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
        }
        set({ user, access_token: accessToken });
      },

      updateUser: (partial) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...partial } });
        }
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
        set({ user: null, access_token: null });
      },

      isAuth: () => !!get().access_token,
    }),
    {
      name: "eduflow-auth",
      partialize: (state) => ({ user: state.user, access_token: state.access_token }),
    }
  )
);

// Rolga qarab yo'naltirish manzili
export const roleRoutes: Record<string, string> = {
  admin: "/admin",
  org_admin: "/org",
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
};
