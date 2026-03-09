// ─── IZMA Server ────────────────────────────────────────────────────────────
// Express HTTP + ws WebSocketServer, backed by PostgreSQL (Supabase).

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuid } from "uuid";
import { parseClientMessage } from "@izma/protocol";

import { ENV } from "./utils/env.ts";
import { testConnection } from "./db.ts";
import { testRedis } from "./redis.ts";
import { authRouter } from "./modules/auth/auth.routes.ts";
import { usersRouter } from "./modules/users/users.routes.ts";
import { gamesRouter } from "./modules/games/games.routes.ts";
import {
    handleAuth,
    handleCreateRoom,
    handleJoinRoom,
    handleJoinRandom,
    handleListRooms,
    handleSetReady,
    handleStartGame,
    handlePlayerAction,
    handleDisconnect,
    handleReconnect,
    handleGlobalChat,
    handleRoomChat,
    handleClanChat,
    handleClanChatJoin,
    handleClanChatLeave,
    addGlobalChatClient,
    removeGlobalChatClient,
    removeClanChatClientFromAll,
} from "./handlers.ts";
import type { WsData } from "./types.ts";

// ─── Express app ────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5050"
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Health check ───────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

// ─── REST routes ────────────────────────────────────────────────────────────

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/games", gamesRouter);

import { rankingsRouter } from "./modules/rankings/rankings.routes.ts";
app.use("/api/rankings", rankingsRouter);

import { clansRouter } from "./modules/clans/clan.routes.ts";
app.use("/api/clans", clansRouter);

// ─── Public rooms list (REST) ───────────────────────────────────────────────

import { getAllRooms } from "./rooms.ts";

app.get("/api/rooms", (_req, res) => {
    const publicRooms = getAllRooms()
        .filter((r) => !r.isPrivate && r.state === "lobby" && r.players.length < r.maxPlayers)
        .map((r) => ({
            id: r.id,
            hostNickname: r.players.find((p) => p.isHost)?.nickname ?? "???",
            playerCount: r.players.length,
            maxPlayers: r.maxPlayers,
            gameIds: r.games.selectedGameIds,
            state: r.state,
        }));
    res.json(publicRooms);
});

// ─── 404 fallback ───────────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ statusCode: 404, error: "Not Found", message: "Not found" });
});

// ─── HTTP server ────────────────────────────────────────────────────────────

const server = createServer(app);

// ─── WebSocket server ───────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

import { getWsData, setWsData } from "./ws-data.ts";
import { verifyToken } from "./modules/auth/jwt.service.ts";

/** Parse cookies from raw Cookie header string. */
function parseCookies(header?: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;
    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx < 1) continue;
        cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
    return cookies;
}

// Handle upgrade requests
server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/ws" || url.pathname === "/ws/") {
        wss.handleUpgrade(req, socket, head, async (ws) => {
            const data: WsData = {
                id: uuid(),
                roomId: null,
                userId: null,
                username: null,
                isGuest: true,
            };

            // Auto-authenticate from accessToken cookie
            const cookies = parseCookies(req.headers.cookie);
            const token = cookies.accessToken;
            if (token) {
                const payload = await verifyToken(token);
                if (payload) {
                    data.userId = payload.sub;
                    data.username = payload.username;
                    data.isGuest = payload.isGuest;
                    console.log(`[ws] auto-authenticated ${payload.username} from cookie`);
                }
            }

            setWsData(ws, data);
            wss.emit("connection", ws, req);
        });
    } else {
        socket.destroy();
    }
});

wss.on("connection", (ws: WebSocket) => {
    const data = getWsData(ws);
    console.log(`[ws] connected  ${data.id}`);

    // Register for global chat
    addGlobalChatClient(ws);

    ws.on("message", (raw: Buffer | string) => {

        const msg = parseClientMessage(raw.toString());
        if (!msg) {
            ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Invalid message." } }));
            return;
        }

        switch (msg.type) {
            case "AUTH":
                void handleAuth(ws, msg.payload);
                break;
            case "CREATE_ROOM":
                void handleCreateRoom(ws, msg.payload);
                break;
            case "JOIN_ROOM":
                handleJoinRoom(ws, msg.payload);
                break;
            case "JOIN_RANDOM":
                handleJoinRandom(ws, msg.payload);
                break;
            case "LIST_ROOMS":
                handleListRooms(ws);
                break;
            case "SET_READY":
                handleSetReady(ws);
                break;
            case "START_GAME":
                handleStartGame(ws);
                break;
            case "PLAYER_ACTION":
                handlePlayerAction(ws, msg.payload);
                break;
            case "RECONNECT":
                void handleReconnect(ws);
                break;
            case "GLOBAL_CHAT":
                void handleGlobalChat(ws, msg.payload);
                break;
            case "ROOM_CHAT":
                handleRoomChat(ws, msg.payload);
                break;
            case "CLAN_CHAT":
                void handleClanChat(ws, msg.payload);
                break;
            case "CLAN_CHAT_JOIN":
                void handleClanChatJoin(ws, msg.payload);
                break;
            case "CLAN_CHAT_LEAVE":
                handleClanChatLeave(ws, msg.payload);
                break;
        }
    });

    ws.on("close", () => {
        removeGlobalChatClient(ws);
        removeClanChatClientFromAll(ws);
        handleDisconnect(ws);
        console.log(`[ws] disconnected ${data.id}`);
    });
});

// ─── Start ──────────────────────────────────────────────────────────────────

async function start() {
    try {
        await testConnection();
        await testRedis();
    } catch (err) {
        console.error("[db] Failed to connect to PostgreSQL:", err);
        process.exit(1);
    }

    server.listen(ENV.PORT, () => {
        console.log(`[server] IZMA server running on http://localhost:${ENV.PORT}`);
    });
}

start();