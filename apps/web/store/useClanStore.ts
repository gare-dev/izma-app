// ─── Clan Store ─────────────────────────────────────────────────────────────
// Manages clan state: current clan, list, chat via WS, membership actions.

import { create } from "zustand";
import type { ClanDetail, PublicClanInfo, ClanChatMessage, CreateClanDTO, UpdateClanDTO, Clan } from "@izma/types";
import {
    apiGetMyClan,
    apiListClans,
    apiGetClan,
    apiCreateClan,
    apiUpdateClan,
    apiDeleteClan,
    apiJoinClan,
    apiJoinClanByInvite,
    apiLeaveClan,
    apiAcceptMember,
    apiRejectMember,
    apiKickMember,
    apiRegenerateInvite,
    apiUploadClanAvatar,
    apiGetClanMessages,
} from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClanStore {
    myClan: ClanDetail | null;
    clanList: PublicClanInfo[];
    messages: ClanChatMessage[];
    loading: boolean;
    error: string | null;
    /** WS reference from game store for clan chat */
    _lastSentAt: number[];

    // ── Data fetching ─────────────────────────────────────────────────────
    fetchMyClan: () => Promise<void>;
    fetchClanList: (search?: string) => Promise<void>;
    fetchClanDetail: (id: string) => Promise<ClanDetail | null>;
    fetchClanMessages: (clanId: string) => Promise<void>;

    // ── Mutations ─────────────────────────────────────────────────────────
    createClan: (dto: CreateClanDTO) => Promise<Clan | null>;
    updateClan: (id: string, dto: UpdateClanDTO) => Promise<boolean>;
    deleteClan: (id: string) => Promise<void>;
    joinClan: (id: string) => Promise<"joined" | "pending" | null>;
    joinByInvite: (code: string) => Promise<Clan | null>;
    leaveClan: (id: string) => Promise<void>;
    acceptMember: (clanId: string, userId: string) => Promise<void>;
    rejectMember: (clanId: string, userId: string) => Promise<void>;
    kickMember: (clanId: string, userId: string) => Promise<void>;
    regenerateInvite: (clanId: string) => Promise<string | null>;
    uploadAvatar: (clanId: string, file: File) => Promise<void>;

    // ── Chat ──────────────────────────────────────────────────────────────
    sendClanMessage: (ws: WebSocket | null, clanId: string, text: string) => boolean;
    addChatMessage: (msg: ClanChatMessage) => void;

    clearError: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_MESSAGES = 200;
const FLOOD_WINDOW_MS = 5_000;
const FLOOD_MAX_MSGS = 3;

// ─── Store ──────────────────────────────────────────────────────────────────

export const useClanStore = create<ClanStore>((set, get) => ({
    myClan: null,
    clanList: [],
    messages: [],
    loading: false,
    error: null,
    _lastSentAt: [],

    // ── Data fetching ─────────────────────────────────────────────────────

    fetchMyClan: async () => {
        set({ loading: true, error: null });
        try {
            const clan = await apiGetMyClan();
            set({ myClan: clan, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    fetchClanList: async (search?: string) => {
        set({ loading: true, error: null });
        try {
            const list = await apiListClans(search);
            set({ clanList: list, loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    fetchClanDetail: async (id: string) => {
        set({ loading: true, error: null });
        try {
            const clan = await apiGetClan(id);
            set({ loading: false });
            return clan;
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
            return null;
        }
    },

    fetchClanMessages: async (clanId: string) => {
        try {
            const msgs = await apiGetClanMessages(clanId);
            set({ messages: msgs });
        } catch {
            // silently ignore
        }
    },

    // ── Mutations ─────────────────────────────────────────────────────────

    createClan: async (dto) => {
        set({ loading: true, error: null });
        try {
            const clan = await apiCreateClan(dto);
            set({ loading: false });
            // Refetch full detail
            await get().fetchMyClan();
            return clan;
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
            return null;
        }
    },

    updateClan: async (id, dto) => {
        set({ loading: true, error: null });
        try {
            await apiUpdateClan(id, dto);
            set({ loading: false });
            await get().fetchMyClan();
            return true;
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
            return false;
        }
    },

    deleteClan: async (id) => {
        set({ loading: true, error: null });
        try {
            await apiDeleteClan(id);
            set({ myClan: null, messages: [], loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    joinClan: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await apiJoinClan(id);
            set({ loading: false });
            if (res.status === "joined") {
                await get().fetchMyClan();
            }
            return res.status;
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
            return null;
        }
    },

    joinByInvite: async (code) => {
        set({ loading: true, error: null });
        try {
            const clan = await apiJoinClanByInvite(code);
            set({ loading: false });
            await get().fetchMyClan();
            return clan;
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
            return null;
        }
    },

    leaveClan: async (id) => {
        set({ loading: true, error: null });
        try {
            await apiLeaveClan(id);
            set({ myClan: null, messages: [], loading: false });
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    acceptMember: async (clanId, userId) => {
        try {
            await apiAcceptMember(clanId, userId);
            await get().fetchMyClan();
        } catch (e) {
            set({ error: (e as Error).message });
        }
    },

    rejectMember: async (clanId, userId) => {
        try {
            await apiRejectMember(clanId, userId);
            await get().fetchMyClan();
        } catch (e) {
            set({ error: (e as Error).message });
        }
    },

    kickMember: async (clanId, userId) => {
        try {
            await apiKickMember(clanId, userId);
            await get().fetchMyClan();
        } catch (e) {
            set({ error: (e as Error).message });
        }
    },

    regenerateInvite: async (clanId) => {
        try {
            const res = await apiRegenerateInvite(clanId);
            await get().fetchMyClan();
            return res.inviteCode;
        } catch (e) {
            set({ error: (e as Error).message });
            return null;
        }
    },

    uploadAvatar: async (clanId, file) => {
        set({ loading: true, error: null });
        try {
            await apiUploadClanAvatar(clanId, file);
            set({ loading: false });
            await get().fetchMyClan();
        } catch (e) {
            set({ loading: false, error: (e as Error).message });
        }
    },

    // ── Chat ──────────────────────────────────────────────────────────────

    sendClanMessage: (ws, clanId, text) => {
        const trimmed = text.trim();
        if (!trimmed || !ws || ws.readyState !== WebSocket.OPEN) return false;

        // Client-side flood gate
        const now = Date.now();
        const stamps = get()._lastSentAt.filter((t) => t > now - FLOOD_WINDOW_MS);
        if (stamps.length >= FLOOD_MAX_MSGS) return false;
        set({ _lastSentAt: [...stamps, now] });

        ws.send(JSON.stringify({
            type: "CLAN_CHAT",
            payload: { clanId, message: trimmed.slice(0, 500) },
        }));

        return true;
    },

    addChatMessage: (msg) => {
        set((s) => ({
            messages: [...s.messages, msg].slice(-MAX_MESSAGES),
        }));
    },

    clearError: () => set({ error: null }),
}));
