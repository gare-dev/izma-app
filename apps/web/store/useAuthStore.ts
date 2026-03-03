// ─── Auth Store ─────────────────────────────────────────────────────────────
// Manages user authentication state. Persists token in localStorage.

import { create } from "zustand";
import type { PublicUser, GuestUser, RegisterDTO, LoginDTO } from "@izma/types";
import { apiRegister, apiLogin, apiGuest, apiLogout, apiGetMe, apiUpdateMe, apiRefreshToken } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthUser = (PublicUser | GuestUser) & { isGuest?: boolean };

interface AuthStore {
    user: AuthUser | null;
    token: string | null;
    loading: boolean;
    error: string | null;

    // ── Actions ───────────────────────────────────────────────────────────
    register: (dto: RegisterDTO) => Promise<void>;
    login: (dto: LoginDTO) => Promise<void>;
    loginAsGuest: (username: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshToken: () => Promise<void>;
    fetchProfile: () => Promise<void>;
    updateProfile: (data: { avatarUrl?: string; bio?: string }) => Promise<void>;
    clearError: () => void;

    // ── Hydrate from localStorage on mount ────────────────────────────────
    hydrate: () => void;
}

// ─── Persistence helpers ────────────────────────────────────────────────────

function persistToken(token: string | null) {
    if (typeof window === "undefined") return;
    if (token) localStorage.setItem("izma_token", token);
    else localStorage.removeItem("izma_token");
}

function persistUser(user: AuthUser | null) {
    if (typeof window === "undefined") return;
    if (user) localStorage.setItem("izma_user", JSON.stringify(user));
    else localStorage.removeItem("izma_user");
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set, get) => ({
    user: null,
    token: null,
    loading: false,
    error: null,

    hydrate: () => {
        if (typeof window === "undefined") return;
        const token = localStorage.getItem("izma_token");
        const raw = localStorage.getItem("izma_user");
        if (token && raw) {
            try {
                const user = JSON.parse(raw) as AuthUser;
                set({ token, user });
            } catch {
                localStorage.removeItem("izma_token");
                localStorage.removeItem("izma_user");
            }
        }
    },

    register: async (dto) => {
        set({ loading: true, error: null });
        try {
            const res = await apiRegister(dto);
            persistToken(res.accessToken);
            persistUser(res.user);
            set({ user: res.user, token: res.accessToken, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    login: async (dto) => {
        set({ loading: true, error: null });
        try {
            const res = await apiLogin(dto);
            persistToken(res.accessToken);
            persistUser(res.user);
            set({ user: res.user, token: res.accessToken, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    loginAsGuest: async (username) => {
        set({ loading: true, error: null });
        try {
            const res = await apiGuest({ username });
            persistToken(res.accessToken);
            persistUser(res.user);
            set({ user: res.user, token: res.accessToken, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    logout: async () => {
        const token = get().token;
        try {
            if (token) await apiLogout(token);
        } catch {
            // best-effort
        }
        persistToken(null);
        persistUser(null);
        set({ user: null, token: null });
    },

    refreshToken: async () => {
        try {
            const res = await apiRefreshToken();
            persistToken(res.accessToken);
            persistUser(res.user);
            set({ user: res.user, token: res.accessToken });
        } catch {
            // refresh failed — force logout
            persistToken(null);
            persistUser(null);
            set({ user: null, token: null });
        }
    },

    fetchProfile: async () => {
        const token = get().token;
        if (!token) return;
        try {
            const user = await apiGetMe(token);
            persistUser(user);
            set({ user });
        } catch {
            // silently ignore
        }
    },

    updateProfile: async (data) => {
        const token = get().token;
        if (!token) return;
        set({ loading: true, error: null });
        try {
            const user = await apiUpdateMe(token, data);
            persistUser(user);
            set({ user, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    clearError: () => set({ error: null }),
}));
