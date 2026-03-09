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
import { getUserById } from "./modules/auth/auth.service.ts";
import { saveClanMessage, isClanMember } from "./modules/clans/clan.service.ts";
import { saveMatch } from "./modules/matches/match.service.ts";
import type { RoomGameSettings } from "@izma/types";

// ─── Global chat state ──────────────────────────────────────────────────────

const globalChatClients = new Set<WebSocket>();

export function addGlobalChatClient(ws: WebSocket): void {
    globalChatClients.add(ws);
}

export function removeGlobalChatClient(ws: WebSocket): void {
    globalChatClients.delete(ws);
}

// Flood protection: max 3 messages per 5 seconds per connection
const FLOOD_WINDOW_MS = 5_000;
const FLOOD_MAX_MSGS = 3;
const chatTimestamps = new WeakMap<WebSocket, number[]>();

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

        const dbUser = data.userId ? await getUserById(data.userId) : null;

        const player: LivePlayer = {
            id: playerId,
            nickname: payload.nickname.trim().slice(0, 20) || "Player",
            score: 0,
            status: "waiting",
            isHost: true,
            userId: data.userId,
            avatarUrl: dbUser?.avatarUrl ?? null,
            bio: dbUser?.bio ?? null,
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

export async function handleJoinRoom(
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
    const dbUser = data.userId ? await getUserById(data.userId) : null;

    const player: LivePlayer = {
        id: playerId,
        nickname: payload.nickname.trim().slice(0, 20) || "Player",
        score: 0,
        status: "waiting",
        isHost: false,
        userId: data.userId,
        avatarUrl: dbUser?.avatarUrl ?? null,
        bio: dbUser?.bio ?? null,
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
            bio: p.bio,
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

                    // ── Save match history ──────────────────────────────
                    try {
                        const registeredPlayers = room.players
                            .filter((p) => p.userId)
                            .map((p) => ({
                                userId: p.userId!,
                                nickname: p.nickname,
                                score: cumulativeScores[p.id] ?? 0,
                            }))
                            .sort((a, b) => b.score - a.score);

                        if (registeredPlayers.length > 0) {
                            const mvpPlayer = room.players.find((p) => p.id === mvp);
                            await saveMatch({
                                roomId: room.id,
                                gameIds: room.games.selectedGameIds,
                                players: registeredPlayers,
                                mvpUserId: mvpPlayer?.userId ?? null,
                            });
                        }
                    } catch (err) {
                        console.error("[match-history] Failed to save match:", err);
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
        bio: oldData?.bio ?? null,
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

// ─── GLOBAL_CHAT ────────────────────────────────────────────────────────────

const MAX_CHAT_MESSAGE_LENGTH = 200;

export async function handleGlobalChat(
    ws: WebSocket,
    payload: { message: string },
) {
    const data = getWsData(ws);
    const username = data.username ?? "Anônimo";

    // Validate message
    const text = (payload.message ?? "").trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!text) return;

    // Flood protection
    const now = Date.now();
    let timestamps = chatTimestamps.get(ws);
    if (!timestamps) {
        timestamps = [];
        chatTimestamps.set(ws, timestamps);
    }

    // Remove timestamps outside window
    while (timestamps.length > 0 && timestamps[0]! < now - FLOOD_WINDOW_MS) {
        timestamps.shift();
    }

    if (timestamps.length >= FLOOD_MAX_MSGS) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Calma! Aguarde um pouco antes de enviar outra mensagem." } }));
        return;
    }

    timestamps.push(now);

    // Resolve avatar and bio for authenticated users
    let avatarUrl: string | null = null;
    let bio: string | null = null;
    if (data.userId) {
        const user = await getUserById(data.userId);
        avatarUrl = user?.avatarUrl ?? null;
        bio = user?.bio ?? null;
    }

    // Broadcast to all global chat clients
    const msg = JSON.stringify({
        type: "GLOBAL_CHAT_MESSAGE",
        payload: {
            id: data.id,
            userId: data.userId,
            username,
            avatarUrl,
            bio,
            message: text,
            timestamp: now,
        },
    });

    for (const client of globalChatClients) {
        if (client.readyState === 1) {
            client.send(msg);
        }
    }
}

// ─── ROOM_CHAT ──────────────────────────────────────────────────────────────

export function handleRoomChat(
    ws: WebSocket,
    payload: { message: string },
) {
    const data = getWsData(ws);
    if (!data.roomId) return;

    const room = getRoom(data.roomId);
    if (!room) return;

    const player = room.players.find((p) => p.id === data.id);
    if (!player) return;

    // Validate message
    const text = (payload.message ?? "").trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!text) return;

    // Flood protection (reuses same WeakMap)
    const now = Date.now();
    let timestamps = chatTimestamps.get(ws);
    if (!timestamps) {
        timestamps = [];
        chatTimestamps.set(ws, timestamps);
    }
    while (timestamps.length > 0 && timestamps[0]! < now - FLOOD_WINDOW_MS) {
        timestamps.shift();
    }
    if (timestamps.length >= FLOOD_MAX_MSGS) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Calma! Aguarde um pouco antes de enviar outra mensagem." } }));
        return;
    }
    timestamps.push(now);

    broadcast(room, {
        type: "ROOM_CHAT_MESSAGE",
        payload: {
            playerId: player.id,
            username: player.nickname,
            avatarUrl: player.avatarUrl,
            bio: player.bio,
            message: text,
            timestamp: now,
        },
    });
}

// ─── Clan chat state ────────────────────────────────────────────────────────

/** Maps clanId → set of connected WebSockets for that clan */
const clanChatClients = new Map<string, Set<WebSocket>>();

export function addClanChatClient(clanId: string, ws: WebSocket): void {
    let set = clanChatClients.get(clanId);
    if (!set) {
        set = new Set();
        clanChatClients.set(clanId, set);
    }
    set.add(ws);
}

export function removeClanChatClient(clanId: string, ws: WebSocket): void {
    const set = clanChatClients.get(clanId);
    if (set) {
        set.delete(ws);
        if (set.size === 0) clanChatClients.delete(clanId);
    }
}

export function removeClanChatClientFromAll(ws: WebSocket): void {
    for (const [clanId, set] of clanChatClients) {
        set.delete(ws);
        if (set.size === 0) clanChatClients.delete(clanId);
    }
}

// ─── CLAN_CHAT_JOIN / CLAN_CHAT_LEAVE ───────────────────────────────────────

export async function handleClanChatJoin(
    ws: WebSocket,
    payload: { clanId: string },
) {
    const data = getWsData(ws);
    if (!data.userId) return;

    const clanId = payload.clanId;
    if (!clanId) return;

    const member = await isClanMember(clanId, data.userId);
    if (!member) return;

    addClanChatClient(clanId, ws);
}

export function handleClanChatLeave(
    ws: WebSocket,
    payload: { clanId: string },
) {
    const clanId = payload.clanId;
    if (!clanId) return;
    removeClanChatClient(clanId, ws);
}

// ─── CLAN_CHAT ──────────────────────────────────────────────────────────────

export async function handleClanChat(
    ws: WebSocket,
    payload: { clanId: string; message: string },
) {
    const data = getWsData(ws);
    if (!data.userId) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Autenticação necessária." } }));
        return;
    }

    const text = (payload.message ?? "").trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!text) return;

    const clanId = payload.clanId;
    if (!clanId) return;

    // Check membership
    const member = await isClanMember(clanId, data.userId);
    if (!member) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Você não é membro deste clã." } }));
        return;
    }

    // Flood protection
    const now = Date.now();
    let timestamps = chatTimestamps.get(ws);
    if (!timestamps) {
        timestamps = [];
        chatTimestamps.set(ws, timestamps);
    }
    while (timestamps.length > 0 && timestamps[0]! < now - FLOOD_WINDOW_MS) {
        timestamps.shift();
    }
    if (timestamps.length >= FLOOD_MAX_MSGS) {
        ws.send(JSON.stringify({ type: "ERROR", payload: { message: "Calma! Aguarde um pouco antes de enviar outra mensagem." } }));
        return;
    }
    timestamps.push(now);

    // Persist & get enriched message
    const saved = await saveClanMessage(clanId, data.userId, text);

    // Register sender in clan chat clients if not already
    addClanChatClient(clanId, ws);

    // Broadcast to all connected clan members
    const msg = JSON.stringify({
        type: "CLAN_CHAT_MESSAGE",
        payload: {
            id: saved.id,
            clanId: saved.clanId,
            userId: saved.userId,
            username: saved.username,
            avatarUrl: saved.avatarUrl,
            message: saved.message,
            timestamp: saved.timestamp,
        },
    });

    const set = clanChatClients.get(clanId);
    if (set) {
        for (const client of set) {
            if (client.readyState === 1) {
                client.send(msg);
            }
        }
    }
}
