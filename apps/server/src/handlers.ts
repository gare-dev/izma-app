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
    getUserRoomId,
    getPersistedRoom,
    cancelRoomExpiry,
    clearUserRoomMapping,
    getDisconnectedPlayer,
    clearDisconnectedPlayer,
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

    try {
        const data = getWsData(ws);
        const playerId = data.id;
        const roomId = uuid().slice(0, 8).toUpperCase();

        // Parse game settings from payload (backward-compatible)
        const games: RoomGameSettings = (payload as any).games ?? {
            totalRounds: 5,
            mode: "MANUAL" as const,
            selectedGameIds: [payload.gameId || "reaction"],
        };

        // Ensure roundsPerGame exists
        if (!games.roundsPerGame) games.roundsPerGame = {};

        // Validate game settings
        if (games.totalRounds < 1 || games.totalRounds > 20) {
            ws.send(JSON.stringify({ type: "ERROR", payload: { message: "totalRounds deve ser entre 1 e 20." } }));
            return;
        }

        // Clamp per-game round values
        for (const [gid, rounds] of Object.entries(games.roundsPerGame)) {
            games.roundsPerGame[gid] = Math.max(1, Math.min(20, rounds));
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
            games.selectedGameIds = await pickRandomGames(1);
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
    } catch (err) {
        console.error("[room] create error:", err);
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Erro ao criar sala." } }));
    }
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
    const maybeRoom = getRoom(data.roomId ?? "");
    if (!maybeRoom || maybeRoom.state !== "lobby") return;
    if (maybeRoom.hostId !== data.id) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Apenas o host pode iniciar." } }));
        return;
    }
    if (maybeRoom.players.length < 2) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "São necessários pelo menos 2 jogadores." } }));
        return;
    }

    const room = maybeRoom;

    room.state = "playing";

    // Reset player scores
    for (const p of room.players) {
        p.score = 0;
        p.status = "playing";
    }

    const schedule = room.games.selectedGameIds;
    const numGames = schedule.length;

    // Broadcast game order
    broadcast(room, {
        type: "ROOM_GAMES_DEFINED",
        payload: {
            totalRounds: room.games.totalRounds,
            gameOrder: schedule,
        },
    });

    // Cumulative scores across all game sessions
    const cumulativeScores: Record<string, number> = {};
    for (const p of room.players) cumulativeScores[p.id] = 0;

    room.currentGameIndex = 0;
    room.gameId = schedule[0] || "reaction";

    function startGameAtIndex(index: number) {
        const gameId = schedule[index]!;
        room.currentGameIndex = index;
        room.gameId = gameId;

        // Determine rounds for this game segment
        const roundsForGame = room.games.mode === "MANUAL"
            ? (room.games.roundsPerGame?.[gameId] ?? room.games.totalRounds)
            : room.games.totalRounds;

        if (room.engine) {
            room.engine.destroy();
            room.engine = null;
        }

        // Reset player status for new game segment
        for (const p of room.players) {
            p.status = "playing";
        }

        const playerSnapshots = room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            status: p.status,
            isHost: p.isHost,
            userId: p.userId,
            avatarUrl: p.avatarUrl,
        }));

        const engine = createEngine(
            gameId,
            playerSnapshots,
            async (msg) => {
                if (msg.type === "GAME_STATE") {
                    // Room scores = cumulative + current engine scores
                    for (const p of room.players) {
                        const engineScore = msg.payload.gameState.scores[p.id] ?? 0;
                        p.score = (cumulativeScores[p.id] ?? 0) + engineScore;
                    }
                    broadcast(room, msg);
                    return;
                }

                if (msg.type === "GAME_END") {
                    const isLastGame = index >= numGames - 1;

                    // Accumulate scores from this game segment
                    for (const p of room.players) {
                        const engineScore = msg.payload.scores[p.id] ?? 0;
                        cumulativeScores[p.id] = (cumulativeScores[p.id] ?? 0) + engineScore;
                        p.score = cumulativeScores[p.id]!;
                    }

                    if (!isLastGame) {
                        // Intermediate game — don't send GAME_END to clients.
                        // The engine's "game_over" phase GAME_STATE already shows
                        // "calculando…" on the client. After a brief pause, start
                        // the next game whose countdown will naturally take over.
                        setRoom(room);
                        setTimeout(() => {
                            if (room.state !== "playing") return;
                            startGameAtIndex(index + 1);
                            broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });
                        }, 2500);
                        return;
                    }

                    // ── Last game — finish the match ────────────────────
                    room.state = "finished";
                    for (const p of room.players) {
                        p.status = "finished";
                    }

                    // Determine overall MVP from cumulative scores
                    let mvp: string | null = null;
                    let bestScore = -1;
                    for (const [id, score] of Object.entries(cumulativeScores)) {
                        if (score > bestScore) {
                            bestScore = score;
                            mvp = id;
                        }
                    }

                    const finalResults = {
                        scores: { ...cumulativeScores },
                        rounds: msg.payload.rounds,
                        mvp,
                    };

                    // ── Award coins ─────────────────────────────────────
                    for (const p of room.players) {
                        if (!p.userId) continue; // guest — no coins

                        const isWinner = p.id === mvp;
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

                    broadcast(room, { type: "GAME_END", payload: finalResults });
                    return;
                }

                // Other messages — forward as-is
                broadcast(room, msg);
            },
            roundsForGame,
        );

        room.engine = engine;
        engine.init();
    }

    startGameAtIndex(0);
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });
    setRoom(room);
    console.log(`[game] ${room.id} started (${numGames} game(s), ${room.games.totalRounds} rounds each)`);
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
    handleJoinRoom(ws, { roomId: room?.id!, nickname: payload.nickname });
}

// ─── DISCONNECT ─────────────────────────────────────────────────────────────

export function handleDisconnect(ws: WebSocket) {
    const data = getWsData(ws);
    const room = getRoom(data.roomId ?? "");
    if (!room) return;

    const player = room.players.find((p) => p.id === data.id);
    const nickname = player?.nickname ?? "unknown";

    const isEmpty = removePlayer(room, data.id);

    if (!isEmpty) {
        broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });
    }

    console.log(`[room] ${nickname} disconnected from ${room.id}`);
}

// ─── RECONNECT ──────────────────────────────────────────────────────────────

export async function handleReconnect(ws: WebSocket) {
    const data = getWsData(ws);
    if (!data.userId) return; // guests can't reconnect

    const roomId = await getUserRoomId(data.userId);
    if (!roomId) return; // no room to reconnect to

    // Check if room is still in memory (other players present)
    let room = getRoom(roomId);

    if (!room) {
        // Room only exists in Redis (all players had disconnected)
        const persisted = await getPersistedRoom(roomId);
        if (!persisted) return; // expired

        room = {
            id: persisted.id,
            hostId: persisted.hostId,
            maxPlayers: persisted.maxPlayers,
            isPrivate: persisted.isPrivate,
            gameId: persisted.gameId,
            games: persisted.games,
            currentGameIndex: persisted.currentGameIndex,
            gameState: null,
            players: [],
            engine: null,
            state: persisted.state === "playing" || persisted.state === "finished"
                ? "lobby"
                : persisted.state,
        } satisfies import("./types.ts").LiveRoom;

        setRoom(room);
        cancelRoomExpiry(roomId);
    }

    // Don't exceed max players
    if (room.players.length >= room.maxPlayers) return;

    // Restore previous player data if available
    const oldData = await getDisconnectedPlayer(roomId, data.userId);

    const playerId = data.id;
    const player: import("./types.ts").LivePlayer = {
        id: playerId,
        nickname: oldData?.nickname ?? data.username ?? "Player",
        score: oldData?.score ?? 0,
        status: "waiting",
        isHost: room.players.length === 0, // host if first back
        userId: data.userId,
        avatarUrl: oldData?.avatarUrl ?? null,
        ws,
    };

    // Remove stale entry for the same user (safety)
    room.players = room.players.filter((p) => p.userId !== data.userId);
    room.players.push(player);

    if (player.isHost) {
        room.hostId = playerId;
    }

    data.roomId = room.id;
    setWsData(ws, data);

    // Clean up reconnection keys
    clearUserRoomMapping(data.userId);
    clearDisconnectedPlayer(roomId, data.userId);

    sendTo(player, { type: "JOINED", payload: { playerId, roomId: room.id } });
    broadcast(room, { type: "ROOM_UPDATE", payload: { room: roomSnapshot(room) } });

    console.log(`[room] ${player.nickname} reconnected to ${room.id}`);
}
