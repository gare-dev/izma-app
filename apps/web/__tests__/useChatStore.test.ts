import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── WebSocket mock ─────────────────────────────────────────────────────────

class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.OPEN;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    send = vi.fn();
    close = vi.fn(() => {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
    });

    constructor() {
        // auto-trigger onopen
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            this.onopen?.();
        }, 0);
    }
}

vi.stubGlobal("WebSocket", MockWebSocket);

// Mock document.cookie for auto-auth
vi.stubGlobal("document", {
    cookie: "accessToken=testtoken123; otherCookie=x",
});

// Mock window for getWsUrl
vi.stubGlobal("window", {
    location: {
        protocol: "http:",
        hostname: "localhost",
        host: "localhost:3000",
    },
});

// Mock process.env
vi.stubGlobal("process", {
    ...process,
    env: { ...process.env, NODE_ENV: "development" },
});

import { useChatStore } from "../store/useChatStore";

function resetStore() {
    useChatStore.setState({
        messages: [],
        connected: false,
        ws: null,
        _lastSentAt: [],
    });
}

describe("useChatStore", () => {
    beforeEach(() => {
        resetStore();
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // connect
    // ═══════════════════════════════════════════════════════════════════════

    describe("connect", () => {
        it("creates a WebSocket and sets it on store", () => {
            useChatStore.getState().connect();
            expect(useChatStore.getState().ws).not.toBeNull();
        });

        it("sets connected=true on open", async () => {
            useChatStore.getState().connect();
            // trigger onopen
            await vi.advanceTimersByTimeAsync(10);
            expect(useChatStore.getState().connected).toBe(true);
        });

        it("sends AUTH with cookie token on open", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            const ws = useChatStore.getState().ws as any;
            expect(ws.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "AUTH", payload: { token: "testtoken123" } }),
            );
        });

        it("does not create duplicate connections", () => {
            useChatStore.getState().connect();
            const ws1 = useChatStore.getState().ws;
            useChatStore.getState().connect();
            expect(useChatStore.getState().ws).toBe(ws1);
        });

        it("adds GLOBAL_CHAT_MESSAGE to messages", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            const ws = useChatStore.getState().ws as any;
            const chatMsg = { id: "m1", userId: "u1", username: "Alice", avatarUrl: null, bio: null, message: "hi", timestamp: 1 };
            ws.onmessage?.({
                data: JSON.stringify({ type: "GLOBAL_CHAT_MESSAGE", payload: chatMsg }),
            });
            expect(useChatStore.getState().messages).toHaveLength(1);
            expect(useChatStore.getState().messages[0]!.id).toBe("m1");
        });

        it("caps messages at 100", async () => {
            useChatStore.setState({
                messages: Array.from({ length: 100 }, (_, i) => ({
                    id: `m${i}`, userId: "u1", username: "A", avatarUrl: null, bio: null, message: "x", timestamp: i,
                })) as any,
            });
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            const ws = useChatStore.getState().ws as any;
            ws.onmessage?.({
                data: JSON.stringify({
                    type: "GLOBAL_CHAT_MESSAGE",
                    payload: { id: "overflow", userId: "u1", username: "A", avatarUrl: null, bio: null, message: "y", timestamp: 999 },
                }),
            });
            expect(useChatStore.getState().messages.length).toBeLessThanOrEqual(100);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // disconnect
    // ═══════════════════════════════════════════════════════════════════════

    describe("disconnect", () => {
        it("closes WS and clears state", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            const ws = useChatStore.getState().ws as any;
            useChatStore.getState().disconnect();
            expect(ws.close).toHaveBeenCalled();
            expect(useChatStore.getState().ws).toBeNull();
            expect(useChatStore.getState().connected).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // reconnect
    // ═══════════════════════════════════════════════════════════════════════

    describe("reconnect", () => {
        it("closes existing and reconnects after delay", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            const oldWs = useChatStore.getState().ws as any;
            useChatStore.getState().reconnect();
            expect(oldWs.close).toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(150);
            expect(useChatStore.getState().ws).not.toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // sendMessage
    // ═══════════════════════════════════════════════════════════════════════

    describe("sendMessage", () => {
        it("returns false when not connected", () => {
            expect(useChatStore.getState().sendMessage("hi")).toBe(false);
        });

        it("returns false for empty text", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            useChatStore.setState({ connected: true }); // ensure connected
            expect(useChatStore.getState().sendMessage("   ")).toBe(false);
        });

        it("returns false for text > 200 chars", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            useChatStore.setState({ connected: true });
            const long = "a".repeat(201);
            expect(useChatStore.getState().sendMessage(long)).toBe(false);
        });

        it("sends GLOBAL_CHAT JSON and returns true", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            useChatStore.setState({ connected: true });
            const result = useChatStore.getState().sendMessage("hello");
            expect(result).toBe(true);
            const ws = useChatStore.getState().ws as any;
            expect(ws.send).toHaveBeenCalledWith(
                JSON.stringify({ type: "GLOBAL_CHAT", payload: { message: "hello" } }),
            );
        });

        it("enforces flood protection (3 msgs / 5s)", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            useChatStore.setState({ connected: true });
            const s = useChatStore.getState();
            s.sendMessage("1");
            s.sendMessage("2");
            s.sendMessage("3");
            expect(useChatStore.getState().sendMessage("4")).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Security
    // ═══════════════════════════════════════════════════════════════════════

    describe("security", () => {
        it("trims whitespace to prevent blank messages", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            useChatStore.setState({ connected: true });
            expect(useChatStore.getState().sendMessage("  \n\t  ")).toBe(false);
        });

        it("rejects messages exceeding length limit", async () => {
            useChatStore.getState().connect();
            await vi.advanceTimersByTimeAsync(10);
            useChatStore.setState({ connected: true });
            expect(useChatStore.getState().sendMessage("a".repeat(201))).toBe(false);
        });
    });
});
