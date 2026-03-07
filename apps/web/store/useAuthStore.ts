// ─── Auth Store ─────────────────────────────────────────────────────────────
// Manages user authentication state. Tokens live in HttpOnly cookies only.

import { create } from "zustand";
import type { PublicUser, GuestUser, RegisterDTO, LoginDTO } from "@izma/types";
import { apiRegister, apiLogin, apiGuest, apiLogout, apiGetMe, apiUpdateMe, apiUploadAvatar, apiRefreshToken } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthUser = (PublicUser | GuestUser) & { isGuest?: boolean };

interface AuthStore {
    user: AuthUser | null;
    loading: boolean;
    error: string | null;

    // ── Actions ───────────────────────────────────────────────────────────
    register: (dto: RegisterDTO) => Promise<void>;
    login: (dto: LoginDTO) => Promise<void>;
    loginAsGuest: (username: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshToken: () => Promise<void>;
    checkAuth: () => Promise<void>;
    fetchProfile: () => Promise<void>;
    updateProfile: (data: { username?: string; avatarUrl?: string; bio?: string }) => Promise<void>;
    uploadAvatar: (file: File) => Promise<void>;
    clearError: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set, get) => ({
    user: null,
    loading: false,
    error: null,

    checkAuth: async () => {
        try {
            const user = await apiGetMe();
            set({ user });
        } catch {
            // No valid cookie — user is not authenticated
            set({ user: null });
        }
    },

    register: async (dto) => {
        set({ loading: true, error: null });
        try {
            const res = await apiRegister(dto);
            set({ user: res.user, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    login: async (dto) => {
        set({ loading: true, error: null });
        try {
            const res = await apiLogin(dto);
            set({ user: res.user, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    loginAsGuest: async (username) => {
        set({ loading: true, error: null });
        try {
            const res = await apiGuest({ username });
            set({ user: res.user, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    logout: async () => {
        try {
            await apiLogout();
        } catch {
            // best-effort
        }
        set({ user: null });
    },

    refreshToken: async () => {
        try {
            const res = await apiRefreshToken();
            set({ user: res.user });
        } catch {
            set({ user: null });
        }
    },

    fetchProfile: async () => {
        if (!get().user) return;
        try {
            const user = await apiGetMe();
            set({ user });
        } catch {
            // silently ignore
        }
    },

    updateProfile: async (data) => {
        if (!get().user) return;
        set({ loading: true, error: null });
        try {
            const user = await apiUpdateMe(data);
            set({ user, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    uploadAvatar: async (file) => {
        if (!get().user) return;
        set({ loading: true, error: null });
        try {
            const user = await apiUploadAvatar(file);
            set({ user, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    clearError: () => set({ error: null }),
}));
