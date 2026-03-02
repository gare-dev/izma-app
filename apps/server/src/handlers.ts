import { v4 as uuid } from "uuid";
import type { ServerWebSocket } from "bun";
import type { ClientMessage } from "@izma/protocol";
import { ReactionGameEngine } from "@izma/game-core";
import {
    getRoom,
    setRoom,
    broadcast,
    sendTo,
    roomSnapshot,
    removePlayer,
} from "./rooms.ts";
import type { LiveRoom, LivePlayer, WsData } from "./types.ts";

// ─── CREATE_ROOM ────────────────────────────────────────────────────────────

export function handleCreateRoom(
    ws: ServerWebSocket<WsData>,
    payload: Extract<ClientMessage, { type: "CREATE_ROOM" }>["payload"],
) {
    const playerId = ws.data.id;
    const roomId = uuid().slice(0, 8).toUpperCase();

    const player: LivePlayer = {
        id: playerId,
        nickname: payload.nickname.trim().slice(0, 20) || "Player",
        score: 0,
        status: "waiting",
        isHost: true,
        ws,
    };

    const room: LiveRoom = {
        id: roomId,
        hostId: playerId,
        players: [player],
        state: "lobby",
        maxPlayers: Math.min(Math.max(payload.maxPlayers, 2), 8),
        gameId: payload.gameId || "reaction",
        gameState: null,
        engine: null,
    };

    setRoom(room);
    ws.data.roomId = roomId;
    ws.subscribe(roomId);

    sendTo(player, { type: "JOINED", payload: { playerId, roomId } });
    sendTo(player, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });

    console.log(`[room] ${roomId} created by ${player.nickname}`);
}

// ─── JOIN_ROOM ──────────────────────────────────────────────────────────────

export function handleJoinRoom(
    ws: ServerWebSocket<WsData>,
    payload: Extract<ClientMessage, { type: "JOIN_ROOM" }>["payload"],
) {
    const room = getRoom(payload.roomId.toUpperCase());

    if (!room) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Sala não encontrada." } }));
        return;
    }
    if (room.state !== "lobby") {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "A partida já começou." } }));
        return;
    }
    if (room.players.length >= room.maxPlayers) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Sala cheia." } }));
        return;
    }

    const playerId = ws.data.id;
    const player: LivePlayer = {
        id: playerId,
        nickname: payload.nickname.trim().slice(0, 20) || "Player",
        score: 0,
        status: "waiting",
        isHost: false,
        ws,
    };

    room.players.push(player);
    ws.data.roomId = room.id;
    ws.subscribe(room.id);

    sendTo(player, { type: "JOINED", payload: { playerId, roomId: room.id } });
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });

    console.log(`[room] ${player.nickname} joined ${room.id}`);
}

// ─── SET_READY ──────────────────────────────────────────────────────────────

export function handleSetReady(ws: ServerWebSocket<WsData>) {
    const room = getRoom(ws.data.roomId ?? "");
    if (!room || room.state !== "lobby") return;

    const player = room.players.find((p) => p.id === ws.data.id);
    if (!player) return;

    player.status = player.status === "ready" ? "waiting" : "ready";
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });
}

// ─── START_GAME ─────────────────────────────────────────────────────────────

export function handleStartGame(ws: ServerWebSocket<WsData>) {
    const room = getRoom(ws.data.roomId ?? "");
    if (!room || room.state !== "lobby") return;
    if (room.hostId !== ws.data.id) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Apenas o host pode iniciar." } }));
        return;
    }
    if (room.players.length < 2) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "São necessários pelo menos 2 jogadores." } }));
        return;
    }

    room.state = "playing";

    // Reset player scores
    for (const p of room.players) {
        p.score = 0;
        p.status = "playing";
    }

    const engine = new ReactionGameEngine(
        room.players.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, status: p.status, isHost: p.isHost })),
        (msg) => {
            // Sync scores back to room players on GAME_STATE / GAME_END
            if (msg.type === "GAME_STATE") {
                for (const p of room.players) {
                    p.score = msg.payload.gameState.scores[p.id] ?? p.score;
                }
            }
            if (msg.type === "GAME_END") {
                room.state = "finished";
                for (const p of room.players) {
                    p.score = msg.payload.scores[p.id] ?? p.score;
                    p.status = "finished";
                }
            }
            broadcast(room, msg);
        },
    );

    room.engine = engine;
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });

    engine.init();
    console.log(`[game] ${room.id} started`);
}

// ─── PLAYER_ACTION ──────────────────────────────────────────────────────────

export function handlePlayerAction(
    ws: ServerWebSocket<WsData>,
    payload: Extract<ClientMessage, { type: "PLAYER_ACTION" }>["payload"],
) {
    const room = getRoom(ws.data.roomId ?? "");
    if (!room || !room.engine) return;

    room.engine.onPlayerAction(ws.data.id, payload.action, payload.data);
}

// ─── DISCONNECT ─────────────────────────────────────────────────────────────

export function handleDisconnect(ws: ServerWebSocket<WsData>) {
    const room = getRoom(ws.data.roomId ?? "");
    if (!room) return;

    const player = room.players.find((p) => p.id === ws.data.id);
    const nickname = player?.nickname ?? "unknown";

    removePlayer(room, ws.data.id);

    if (room.players.length > 0) {
        broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });
    }

    console.log(`[room] ${nickname} disconnected from ${room.id}`);
}
