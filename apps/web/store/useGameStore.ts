import { create } from "zustand";
import type { Room, ReactionGameState, Game, GameSelectionMode, RoomGameSettings } from "@izma/types";
import type { ServerMessage, GameResults, ClientMessage } from "@izma/protocol";
import { apiGetGames } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────────

type ConnectStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

interface GameStore {
    // ── Connection ────────────────────────────────────────────────────────────
    ws: WebSocket | null;
    status: ConnectStatus;

    // ── Identity ──────────────────────────────────────────────────────────────
    playerId: string | null;
    nickname: string;

    // ── Room ──────────────────────────────────────────────────────────────────
    room: Room | null;
    gameState: ReactionGameState | null;
    gameResults: GameResults | null;
    error: string | null;

    // ── Game Selection (for room creation) ────────────────────────────────────
    availableGames: Game[];
    selectedGameIds: string[];
    totalRounds: number;
    selectionMode: GameSelectionMode;
    gameOrder: string[];           // from ROOM_GAMES_DEFINED

    // ── Coins notification ────────────────────────────────────────────────────
    lastCoinUpdate: { delta: number; coins: number; reason: string } | null;

    // ── Actions ───────────────────────────────────────────────────────────────
    setNickname: (n: string) => void;
    connect: (onOpen?: () => void) => void;
    disconnect: () => void;
    send: (msg: ClientMessage) => void;

    // ── Game selection actions ─────────────────────────────────────────────────
    fetchGames: () => Promise<void>;
    setSelectionMode: (mode: GameSelectionMode) => void;
    setTotalRounds: (n: number) => void;
    toggleGameSelection: (gameId: string) => void;

    // ── High-level helpers ────────────────────────────────────────────────────
    createRoom: (nickname: string, maxPlayers: number, gameSettings?: RoomGameSettings) => void;
    joinRoom: (roomId: string, nickname: string) => void;
    setReady: () => void;
    startGame: () => void;
    react: () => void;
    clearError: () => void;
    resetGame: () => void;
}

// ─── WS URL ────────────────────────────────────────────────────────────────

function getWsUrl(): string {
    if (typeof window === "undefined") return "";
    const base = process.env.NEXT_PUBLIC_WS_URL;
    if (base) return base;

    // In development connect directly to server
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NODE_ENV === "development"
        ? `${window.location.hostname}:5051`
        : window.location.host;
    return `${proto}://${host}/ws/`;
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
    ws: null,
    status: "idle",
    playerId: null,
    nickname: "",
    room: null,
    gameState: null,
    gameResults: null,
    error: null,

    // Game selection defaults
    availableGames: [],
    selectedGameIds: ["reaction"],
    totalRounds: 3,
    selectionMode: "MANUAL",
    gameOrder: [],
    lastCoinUpdate: null,

    setNickname: (n) => set({ nickname: n }),

    // ── Game selection ────────────────────────────────────────────────────────

    fetchGames: async () => {
        try {
            const games = await apiGetGames();
            set({ availableGames: games });
        } catch {
            // fallback — keep empty
        }
    },

    setSelectionMode: (mode) => set({ selectionMode: mode }),
    setTotalRounds: (n) => set({ totalRounds: Math.max(1, Math.min(20, n)) }),
    toggleGameSelection: (gameId) => {
        const current = get().selectedGameIds;
        if (current.includes(gameId)) {
            // Don't allow removing the last game
            if (current.length > 1) {
                set({ selectedGameIds: current.filter((g) => g !== gameId) });
            }
        } else {
            set({ selectedGameIds: [...current, gameId] });
        }
    },

    // ── Connection ────────────────────────────────────────────────────────────

    connect: (onOpen) => {
        const existing = get().ws;
        if (existing && existing.readyState < WebSocket.CLOSING) return;

        const url = getWsUrl();
        if (!url) return;

        const ws = new WebSocket(url);
        set({ ws, status: "connecting" });

        ws.onopen = () => {
            set({ status: "connected" });

            // Send auth token over WS if available
            if (typeof window !== "undefined") {
                const token = localStorage.getItem("izma_token");
                if (token) {
                    ws.send(JSON.stringify({ type: "AUTH", payload: { token } }));
                }
            }

            onOpen?.();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string) as ServerMessage;
                handleMessage(msg);
            } catch {
                console.error("[ws] invalid message", event.data);
            }
        };

        ws.onerror = () => set({ status: "error", error: "Erro de conexão." });

        ws.onclose = () => {
            set({ ws: null, status: "disconnected" });
        };
    },

    disconnect: () => {
        get().ws?.close();
        set({ ws: null, status: "idle", room: null, gameState: null, gameResults: null, gameOrder: [], lastCoinUpdate: null });
    },

    send: (msg) => {
        const { ws, status } = get();
        if (ws && status === "connected") {
            ws.send(JSON.stringify(msg));
        }
    },

    // ── Helpers ───────────────────────────────────────────────────────────────

    createRoom: (nickname, maxPlayers, gameSettings) => {
        const { connect, send, setNickname, totalRounds, selectionMode, selectedGameIds } = get();
        setNickname(nickname);
        set({ gameResults: null, gameState: null, room: null, gameOrder: [], lastCoinUpdate: null });

        const games: RoomGameSettings = gameSettings ?? {
            totalRounds,
            mode: selectionMode,
            selectedGameIds: selectionMode === "MANUAL" ? selectedGameIds : [],
        };

        connect(() => {
            send({
                type: "CREATE_ROOM",
                payload: { nickname, maxPlayers, gameId: games.selectedGameIds[0] || "reaction", games },
            });
        });
    },

    joinRoom: (roomId, nickname) => {
        const { connect, send, setNickname } = get();
        setNickname(nickname);
        set({ gameResults: null, gameState: null, room: null, gameOrder: [], lastCoinUpdate: null });
        connect(() => {
            send({ type: "JOIN_ROOM", payload: { roomId, nickname } });
        });
    },

    setReady: () => get().send({ type: "SET_READY" }),
    startGame: () => get().send({ type: "START_GAME" }),
    react: () => get().send({ type: "PLAYER_ACTION", payload: { action: "REACT" } }),

    clearError: () => set({ error: null }),

    resetGame: () => {
        set({ gameState: null, gameResults: null, lastCoinUpdate: null });
        // Re-enter lobby
        const room = get().room;
        if (room) {
            set({ room: { ...room, state: "lobby" } });
        }
    },
}));

// ─── Message handler (called from ws.onmessage) ────────────────────────────

function handleMessage(msg: ServerMessage) {
    switch (msg.type) {
        case "JOINED":
            useGameStore.setState({ playerId: msg.payload.playerId });
            break;

        case "ROOM_UPDATE":
            useGameStore.setState({ room: msg.payload.room });
            break;

        case "GAME_STATE":
            useGameStore.setState({ gameState: msg.payload.gameState });
            break;

        case "GAME_END":
            useGameStore.setState({ gameResults: msg.payload });
            break;

        case "ERROR":
            useGameStore.setState({ error: msg.payload.message });
            break;

        case "AUTH_OK":
            // WS is now authenticated — no state action needed
            console.log(`[ws] authenticated as ${msg.payload.username}`);
            break;

        case "ROOM_GAMES_DEFINED":
            useGameStore.setState({ gameOrder: msg.payload.gameOrder });
            break;

        case "COINS_UPDATE":
            useGameStore.setState({
                lastCoinUpdate: {
                    delta: msg.payload.delta,
                    coins: msg.payload.coins,
                    reason: msg.payload.reason,
                },
            });
            break;
    }
}
