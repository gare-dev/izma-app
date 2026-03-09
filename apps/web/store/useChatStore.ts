import { create } from "zustand";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
    id: string;
    userId: string | null;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    message: string;
    timestamp: number;
}

interface ChatStore {
    messages: ChatMessage[];
    connected: boolean;
    ws: WebSocket | null;
    /** Client-side flood tracking */
    _lastSentAt: number[];

    connect: () => void;
    disconnect: () => void;
    /** Reconnect WS (e.g. after login to refresh auth) */
    reconnect: () => void;
    sendMessage: (text: string) => boolean;
}

// ─── WS URL ────────────────────────────────────────────────────────────────

function getWsUrl(): string {
    if (typeof window === "undefined") return "";
    const base = process.env.NEXT_PUBLIC_WS_URL;
    if (base) return base;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NODE_ENV === "development"
        ? `${window.location.hostname}:5051`
        : window.location.host;
    return `${proto}://${host}/ws/`;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_MESSAGES = 100;
const FLOOD_WINDOW_MS = 5_000;
const FLOOD_MAX_MSGS = 3;

// ─── Store ─────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>((set, get) => ({
    messages: [],
    connected: false,
    ws: null,
    _lastSentAt: [],

    connect: () => {
        const existing = get().ws;
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const url = getWsUrl();
        if (!url) return;

        const ws = new WebSocket(url);

        ws.onopen = () => {
            set({ connected: true });

            // Auto-auth from cookie (send AUTH if available)
            const cookie = document.cookie
                .split("; ")
                .find((c) => c.startsWith("accessToken="));
            if (cookie) {
                const token = cookie.split("=")[1];
                if (token) {
                    ws.send(JSON.stringify({ type: "AUTH", payload: { token } }));
                }
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);
                if (msg.type === "GLOBAL_CHAT_MESSAGE") {
                    const chatMsg: ChatMessage = msg.payload;
                    set((s) => ({
                        messages: [...s.messages.slice(-(MAX_MESSAGES - 1)), chatMsg],
                    }));
                }
            } catch { /* ignore */ }
        };

        ws.onclose = () => {
            set({ connected: false, ws: null });
        };

        ws.onerror = () => {
            set({ connected: false });
        };

        set({ ws });
    },

    disconnect: () => {
        get().ws?.close();
        set({ ws: null, connected: false });
    },

    reconnect: () => {
        const existing = get().ws;
        if (existing) existing.close();
        set({ ws: null, connected: false });
        // Small delay to let the old socket fully close
        setTimeout(() => get().connect(), 100);
    },

    sendMessage: (text: string): boolean => {
        const { ws, connected, _lastSentAt } = get();
        if (!ws || !connected) return false;

        const trimmed = text.trim();
        if (!trimmed || trimmed.length > 200) return false;

        // Client-side flood gate
        const now = Date.now();
        const recent = _lastSentAt.filter((t) => t > now - FLOOD_WINDOW_MS);
        if (recent.length >= FLOOD_MAX_MSGS) return false;

        ws.send(JSON.stringify({ type: "GLOBAL_CHAT", payload: { message: trimmed } }));
        set({ _lastSentAt: [...recent, now] });
        return true;
    },
}));
