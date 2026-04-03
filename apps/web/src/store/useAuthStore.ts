import { create } from "zustand";
import type { AppUser } from "../types/auth";

interface AuthState {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
