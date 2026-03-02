import { v4 as uuid } from "uuid";
import { parseClientMessage } from "@izma/protocol";
import type { WsData } from "./types.ts";
import {
    handleCreateRoom,
    handleJoinRoom,
    handleSetReady,
    handleStartGame,
    handlePlayerAction,
    handleDisconnect,
} from "./handlers.ts";

const PORT = Number(process.env.PORT ?? 3001);

Bun.serve<WsData>({
    port: PORT,

    fetch(req, server) {
        const url = new URL(req.url);

        // Health check
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ ok: true }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        // WebSocket upgrade
        if (url.pathname === "/ws/" || url.pathname === "/ws") {
            const upgraded = server.upgrade(req, {
                data: { id: uuid(), roomId: null } satisfies WsData,
            });
            if (upgraded) return undefined;
        }

        return new Response("Not found", { status: 404 });
    },

    websocket: {
        open(ws) {
            console.log(`[ws] connected  ${ws.data.id}`);
        },

        message(ws, raw) {
            const msg = parseClientMessage(raw.toString());
            if (!msg) {
                ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Invalid message." } }));
                return;
            }

            switch (msg.type) {
                case "CREATE_ROOM":
                    handleCreateRoom(ws, msg.payload);
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
        },

        close(ws) {
            handleDisconnect(ws);
            console.log(`[ws] disconnected ${ws.data.id}`);
        },
    },
});

console.log(`[server] IZMA server running on ws://localhost:${PORT}`);