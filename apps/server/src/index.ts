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
import { authRouter } from "./modules/auth/auth.routes.ts";
import { usersRouter } from "./modules/users/users.routes.ts";
import { gamesRouter } from "./modules/games/games.routes.ts";
import {
    handleAuth,
    handleCreateRoom,
    handleJoinRoom,
    handleSetReady,
    handleStartGame,
    handlePlayerAction,
    handleDisconnect,
} from "./handlers.ts";
import type { WsData } from "./types.ts";

// ─── Express app ────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
    origin: [
        "http://localhost:3000",
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

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/games", gamesRouter);

// ─── 404 fallback ───────────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ statusCode: 404, error: "Not Found", message: "Not found" });
});

// ─── HTTP server ────────────────────────────────────────────────────────────

const server = createServer(app);

// ─── WebSocket server ───────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

import { getWsData, setWsData } from "./ws-data.ts";

// Handle upgrade requests
server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/ws" || url.pathname === "/ws/") {
        wss.handleUpgrade(req, socket, head, (ws) => {
            const data: WsData = {
                id: uuid(),
                roomId: null,
                userId: null,
                username: null,
                isGuest: true,
            };
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
            case "SET_READY":
                handleSetReady(ws);
                break;
            case "START_GAME":
                handleStartGame(ws);
                break;
            case "PLAYER_ACTION":
                handlePlayerAction(ws, msg.payload);
                break;
        }
    });

    ws.on("close", () => {
        handleDisconnect(ws);
        console.log(`[ws] disconnected ${data.id}`);
    });
});

// ─── Start ──────────────────────────────────────────────────────────────────

async function start() {
    try {
        await testConnection();
    } catch (err) {
        console.error("[db] Failed to connect to PostgreSQL:", err);
        process.exit(1);
    }

    server.listen(ENV.PORT, () => {
        console.log(`[server] IZMA server running on http://localhost:${ENV.PORT}`);
    });
}

start();