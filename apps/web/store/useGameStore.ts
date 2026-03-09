import { create } from "zustand";
import type { Room, AnyGameState, Game, GameSelectionMode, RoomGameSettings, PublicRoomInfo } from "@izma/types";
import type { ServerMessage, GameResults, ClientMessage } from "@izma/protocol";
import { apiGetGames, apiGetPublicRooms } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RoomChatMessage {
    playerId: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    message: string;
    timestamp: number;
}

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
    gameState: AnyGameState | null;
    gameResults: GameResults | null;
    error: string | null;

    // ── Game Selection (for room creation) ────────────────────────────────────
    availableGames: Game[];
    selectedGameIds: string[];
    totalRounds: number;
    roundsPerGame: Record<string, number>;
    selectionMode: GameSelectionMode;
    gameOrder: string[];           // from ROOM_GAMES_DEFINED

    // ── Coins notification ────────────────────────────────────────────────────
    lastCoinUpdate: { delta: number; coins: number; reason: string } | null;

    // ── Public rooms ──────────────────────────────────────────────────────────
    publicRooms: PublicRoomInfo[];

    // ── Room chat ─────────────────────────────────────────────────────────────
    roomMessages: RoomChatMessage[];
    _roomChatLastSent: number[];

    // ── Actions ───────────────────────────────────────────────────────────────
    setNickname: (n: string) => void;
    connect: (onOpen?: () => void) => void;
    disconnect: () => void;
    send: (msg: ClientMessage) => void;

    // ── Game selection actions ─────────────────────────────────────────────────
    fetchGames: () => Promise<void>;
    setSelectionMode: (mode: GameSelectionMode) => void;
    setTotalRounds: (n: number) => void;
    setGameRounds: (gameId: string, n: number) => void;
    toggleGameSelection: (gameId: string) => void;

    // ── High-level helpers ────────────────────────────────────────────────────
    createRoom: (nickname: string, maxPlayers: number, gameSettings?: RoomGameSettings, isPrivate?: boolean) => void;
    joinRoom: (roomId: string, nickname: string) => void;
    joinRandomRoom: (nickname: string) => void;
    fetchPublicRooms: () => Promise<void>;
    setReady: () => void;
    startGame: () => void;
    sendAction: (action: string, data?: unknown) => void;
    react: () => void;
    sendRoomMessage: (text: string) => boolean;
    clearError: () => void;
    resetGame: () => void;
    tryReconnect: () => void;
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
    roundsPerGame: {},
    selectionMode: "MANUAL",
    gameOrder: [],
    lastCoinUpdate: null,
    publicRooms: [],
    roomMessages: [],
    _roomChatLastSent: [],

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
    setGameRounds: (gameId, n) => {
        const clamped = Math.max(1, Math.min(20, n));
        set({ roundsPerGame: { ...get().roundsPerGame, [gameId]: clamped } });
    },
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
        // If already open, fire callback immediately
        if (existing && existing.readyState === WebSocket.OPEN) {
            onOpen?.();
            return;
        }
        if (existing && existing.readyState === WebSocket.CONNECTING) {
            if (onOpen) {
                existing.onopen = () => {
                    set({ status: "connected" });
                    onOpen();
                };
            }
            return;
        }

        // If CLOSING, detach old handlers so they don't clobber the new socket
        if (existing) {
            existing.onopen = null;
            existing.onmessage = null;
            existing.onerror = null;
            existing.onclose = null;
        }

        const url = getWsUrl();
        if (!url) return;

        const ws = new WebSocket(url);
        set({ ws, status: "connecting" });

        ws.onopen = () => {
            set({ status: "connected" });

            if (onOpen) {
                onOpen();
            } else {
                // No explicit action — attempt auto-reconnect
                ws.send(JSON.stringify({ type: "RECONNECT" }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string) as ServerMessage;
                handleMessage(msg);
            } catch {
                console.error("[ws] invalid message", event.data);
            }
        };

        ws.onerror = () => {
            // Only act if this is still the current socket
            if (get().ws === ws) set({ status: "error", error: "Erro de conexão." });
        };

        ws.onclose = () => {
            // Only act if this is still the current socket
            if (get().ws === ws) set({ ws: null, status: "disconnected" });
        };
    },

    disconnect: () => {
        const old = get().ws;
        if (old) {
            old.onopen = null;
            old.onmessage = null;
            old.onerror = null;
            old.onclose = null;
            old.close();
        }
        set({ ws: null, status: "idle", room: null, gameState: null, gameResults: null, gameOrder: [], lastCoinUpdate: null, roomMessages: [], error: null });
    },

    send: (msg) => {
        const { ws, status } = get();
        if (ws && status === "connected") {
            ws.send(JSON.stringify(msg));
        }
    },

    // ── Helpers ───────────────────────────────────────────────────────────────

    createRoom: (nickname, maxPlayers, gameSettings, isPrivate) => {
        const { connect, send, setNickname, totalRounds, selectionMode, selectedGameIds, roundsPerGame } = get();
        setNickname(nickname);
        set({ gameResults: null, gameState: null, room: null, gameOrder: [], lastCoinUpdate: null, roomMessages: [], error: null });

        const games: RoomGameSettings = gameSettings ?? {
            totalRounds,
            mode: selectionMode,
            selectedGameIds: selectionMode === "MANUAL" ? selectedGameIds : [],
            roundsPerGame: selectionMode === "MANUAL" ? roundsPerGame : undefined,
        };

        connect(() => {
            send({
                type: "CREATE_ROOM",
                payload: { nickname, maxPlayers, gameId: games.selectedGameIds[0] || "reaction", games, isPrivate },
            });
        });
    },

    joinRoom: (roomId, nickname) => {
        const { connect, send, setNickname } = get();
        setNickname(nickname);
        set({ gameResults: null, gameState: null, room: null, gameOrder: [], lastCoinUpdate: null, roomMessages: [], error: null });
        connect(() => {
            send({ type: "JOIN_ROOM", payload: { roomId, nickname } });
        });
    },

    joinRandomRoom: (nickname) => {
        const { connect, send, setNickname } = get();
        setNickname(nickname);
        set({ gameResults: null, gameState: null, room: null, gameOrder: [], lastCoinUpdate: null, roomMessages: [], error: null });
        connect(() => {
            send({ type: "JOIN_RANDOM", payload: { nickname } });
        });
    },

    fetchPublicRooms: async () => {
        try {
            const rooms = await apiGetPublicRooms();
            set({ publicRooms: rooms });
        } catch {
            // ignore
        }
    },

    sendRoomMessage: (text: string): boolean => {
        const { ws, status, _roomChatLastSent } = get();
        if (!ws || status !== "connected") return false;
        const trimmed = text.trim();
        if (!trimmed || trimmed.length > 200) return false;
        const now = Date.now();
        const recent = _roomChatLastSent.filter((t) => t > now - 5_000);
        if (recent.length >= 3) return false;
        ws.send(JSON.stringify({ type: "ROOM_CHAT", payload: { message: trimmed } }));
        set({ _roomChatLastSent: [...recent, now] });
        return true;
    },

    setReady: () => get().send({ type: "SET_READY" }),
    startGame: () => get().send({ type: "START_GAME" }),
    sendAction: (action, data) => get().send({ type: "PLAYER_ACTION", payload: { action, data } }),
    react: () => get().sendAction("REACT"),

    clearError: () => set({ error: null }),

    resetGame: () => {
        set({ gameState: null, gameResults: null, lastCoinUpdate: null });
        // Re-enter lobby
        const room = get().room;
        if (room) {
            set({ room: { ...room, state: "lobby" } });
        }
    },

    tryReconnect: () => {
        const { ws, status } = get();
        if (ws || status !== "idle") return;
        get().connect(); // no onOpen → will send RECONNECT on open
    },
}));

// ─── Message handler (called from ws.onmessage) ────────────────────────────

async function handleMessage(msg: ServerMessage) {
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

        case "ROOM_LIST":
            useGameStore.setState({ publicRooms: msg.payload.rooms });
            break;

        case "ROOM_CHAT_MESSAGE":
            useGameStore.setState((s) => ({
                roomMessages: [...s.roomMessages.slice(-99), msg.payload],
            }));
            break;

        case "CLAN_CHAT_MESSAGE": {
            const { useClanStore } = await import("./useClanStore");
            useClanStore.getState().addChatMessage(msg.payload);
            break;
        }
    }
}
