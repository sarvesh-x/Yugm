import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { User } from "@/lib/types";

interface AuthState {
  token?: string;
  user?: User;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  setHydrated: (value: boolean) => set({ hydrated: value }),
  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync("yugm.token");
      const rawUser = await SecureStore.getItemAsync("yugm.user");
      set({ token: token ?? undefined, user: rawUser ? JSON.parse(rawUser) : undefined, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setSession: async (token, user) => {
    await SecureStore.setItemAsync("yugm.token", token);
    await SecureStore.setItemAsync("yugm.user", JSON.stringify(user));
    set({ token, user });
  },
  updateUser: (user) => {
    try {
      SecureStore.setItemAsync("yugm.user", JSON.stringify(user)).catch((e) => console.error("SecureStore write failed", e));
    } catch {}
    set({ user });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync("yugm.token");
    await SecureStore.deleteItemAsync("yugm.user");
    set({ token: undefined, user: undefined });
  }
}));
