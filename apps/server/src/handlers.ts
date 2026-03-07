import { v4 as uuid } from "uuid";
import type { WebSocket } from "ws";
import type { ClientMessage } from "@izma/protocol";
import { createEngine } from "@izma/game-core";
import {
    getRoom,
    setRoom,
    getAllRooms,
    broadcast,
    sendTo,
    roomSnapshot,
    removePlayer,
} from "./rooms.ts";
import type { LiveRoom, LivePlayer, WsData } from "./types.ts";
import { getWsData, setWsData } from "./ws-data.ts";
import { verifyToken } from "./modules/auth/jwt.service.ts";
import { getGameById, pickRandomGames } from "./modules/games/games.service.ts";
import { awardCoins, COINS } from "./modules/coins/coin.service.ts";
import type { RoomGameSettings } from "@izma/types";

// ─── AUTH (over WebSocket) ──────────────────────────────────────────────────

export async function handleAuth(
    ws: WebSocket,
    payload: { token: string },
) {
    const data = getWsData(ws);
    const decoded = await verifyToken(payload.token);
    if (!decoded) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Token inválido." } }));
        return;
    }
    data.userId = decoded.sub;
    data.username = decoded.username;
    data.isGuest = decoded.isGuest;
    setWsData(ws, data);
    ws.send(JSON.stringify({ type: "AUTH_OK", payload: { userId: decoded.sub, username: decoded.username } }));
    console.log(`[ws] authenticated ${decoded.username} (guest=${decoded.isGuest})`);
}

// ─── CREATE_ROOM ────────────────────────────────────────────────────────────

export async function handleCreateRoom(
    ws: WebSocket,
    payload: Extract<ClientMessage, { type: "CREATE_ROOM" }>["payload"],
) {
    const data = getWsData(ws);
    const playerId = data.id;
    const roomId = uuid().slice(0, 8).toUpperCase();

    // Parse game settings from payload (backward-compatible)
    const games: RoomGameSettings = (payload as any).games ?? {
        totalRounds: 5,
        mode: "MANUAL" as const,
        selectedGameIds: [payload.gameId || "reaction"],
    };

    // Validate game settings
    if (games.totalRounds < 1 || games.totalRounds > 20) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "totalRounds deve ser entre 1 e 20." } }));
        return;
    }
    if (games.mode === "MANUAL") {
        if (!games.selectedGameIds || games.selectedGameIds.length === 0) {
            ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Selecione pelo menos 1 jogo." } }));
            return;
        }
        for (const gid of games.selectedGameIds) {
            if (!await getGameById(gid)) {
                ws.send(JSON.stringify({ type: "ERROR", payload: { message: `Jogo "${gid}" não encontrado.` } }));
                return;
            }
        }
    }
    if (games.mode === "RANDOM") {
        games.selectedGameIds = await pickRandomGames(games.totalRounds);
    }

    const player: LivePlayer = {
        id: playerId,
        nickname: payload.nickname.trim().slice(0, 20) || "Player",
        score: 0,
        status: "waiting",
        isHost: true,
        userId: data.userId,
        avatarUrl: null,
        ws,
    };

    const room: LiveRoom = {
        id: roomId,
        hostId: playerId,
        players: [player],
        state: "lobby",
        maxPlayers: Math.min(Math.max(payload.maxPlayers, 2), 8),
        isPrivate: !!(payload as any).isPrivate,
        gameId: games.selectedGameIds[0] || "reaction",
        games,
        currentGameIndex: 0,
        gameState: null,
        engine: null,
    };

    setRoom(room);
    data.roomId = roomId;
    setWsData(ws, data);

    sendTo(player, { type: "JOINED", payload: { playerId, roomId } });
    sendTo(player, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });

    console.log(`[room] ${roomId} created by ${player.nickname} (${games.totalRounds} rounds, mode=${games.mode})`);
}

// ─── JOIN_ROOM ──────────────────────────────────────────────────────────────

export function handleJoinRoom(
    ws: WebSocket,
    payload: Extract<ClientMessage, { type: "JOIN_ROOM" }>["payload"],
) {
    const data = getWsData(ws);
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

    const playerId = data.id;
    const player: LivePlayer = {
        id: playerId,
        nickname: payload.nickname.trim().slice(0, 20) || "Player",
        score: 0,
        status: "waiting",
        isHost: false,
        userId: data.userId,
        avatarUrl: null,
        ws,
    };

    room.players.push(player);
    data.roomId = room.id;
    setWsData(ws, data);

    sendTo(player, { type: "JOINED", payload: { playerId, roomId: room.id } });
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });

    console.log(`[room] ${player.nickname} joined ${room.id}`);
}

// ─── SET_READY ──────────────────────────────────────────────────────────────

export function handleSetReady(ws: WebSocket) {
    const data = getWsData(ws);
    const room = getRoom(data.roomId ?? "");
    if (!room || room.state !== "lobby") return;

    const player = room.players.find((p) => p.id === data.id);
    if (!player) return;

    player.status = player.status === "ready" ? "waiting" : "ready";
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });
}

// ─── START_GAME ─────────────────────────────────────────────────────────────

export function handleStartGame(ws: WebSocket) {
    const data = getWsData(ws);
    const room = getRoom(data.roomId ?? "");
    if (!room || room.state !== "lobby") return;
    if (room.hostId !== data.id) {
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

    // Broadcast game order
    broadcast(room, {
        type: "ROOM_GAMES_DEFINED",
        payload: {
            totalRounds: room.games.totalRounds,
            gameOrder: room.games.selectedGameIds,
        },
    });

    const engine = createEngine(
        room.gameId,
        room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            status: p.status,
            isHost: p.isHost,
            userId: p.userId,
            avatarUrl: p.avatarUrl,
        })),
        async (msg) => {
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

                // ── Award coins ─────────────────────────────────────────
                for (const p of room.players) {
                    if (!p.userId) continue; // guest — no coins

                    const isWinner = p.id === msg.payload.mvp;
                    const reason = isWinner ? "VICTORY" as const : "PARTICIPATION" as const;
                    const result = await awardCoins(p.userId, reason, room.id);

                    if (result) {
                        sendTo(p, {
                            type: "COINS_UPDATE",
                            payload: {
                                userId: result.userId,
                                coins: result.newBalance,
                                delta: result.delta,
                                reason: result.reason,
                            },
                        });
                    }
                }
            }
            broadcast(room, msg);
        },
        room.games.totalRounds,
    );

    room.engine = engine;
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });

    engine.init();
    console.log(`[game] ${room.id} started`);
}

// ─── PLAYER_ACTION ──────────────────────────────────────────────────────────

export function handlePlayerAction(
    ws: WebSocket,
    payload: Extract<ClientMessage, { type: "PLAYER_ACTION" }>["payload"],
) {
    const data = getWsData(ws);
    const room = getRoom(data.roomId ?? "");
    if (!room || !room.engine) return;

    room.engine.onPlayerAction(data.id, payload.action, payload.data);
}

// ─── LIST_ROOMS ─────────────────────────────────────────────────────────────

export function handleListRooms(ws: WebSocket) {
    const publicRooms = getAllRooms()
        .filter((r) => !r.isPrivate && r.state === "lobby" && r.players.length < r.maxPlayers);

    const rooms = publicRooms.map((r) => ({
        id: r.id,
        hostNickname: r.players.find((p) => p.isHost)?.nickname ?? "???",
        playerCount: r.players.length,
        maxPlayers: r.maxPlayers,
        gameIds: r.games.selectedGameIds,
        state: r.state as import("@izma/types").RoomState,
    }));

    ws.send(JSON.stringify({ type: "ROOM_LIST", payload: { rooms } }));
}

// ─── JOIN_RANDOM ────────────────────────────────────────────────────────────

export function handleJoinRandom(
    ws: WebSocket,
    payload: { nickname: string },
) {
    const candidates = getAllRooms()
        .filter((r) => !r.isPrivate && r.state === "lobby" && r.players.length < r.maxPlayers);

    if (candidates.length === 0) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Nenhuma sala pública disponível." } }));
        return;
    }

    const room = candidates[Math.floor(Math.random() * candidates.length)];
    handleJoinRoom(ws, { roomId: room.id, nickname: payload.nickname });
}

// ─── DISCONNECT ─────────────────────────────────────────────────────────────

export function handleDisconnect(ws: WebSocket) {
    const data = getWsData(ws);
    const room = getRoom(data.roomId ?? "");
    if (!room) return;

    const player = room.players.find((p) => p.id === data.id);
    const nickname = player?.nickname ?? "unknown";

    removePlayer(room, data.id);

    if (room.players.length > 0) {
        broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });
    }

    console.log(`[room] ${nickname} disconnected from ${room.id}`);
}
