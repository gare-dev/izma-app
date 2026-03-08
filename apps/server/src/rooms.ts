import type { LiveRoom, LivePlayer } from "./types.ts";
import type { ServerMessage } from "@izma/protocol";
import { redis } from "./redis.ts";

// ─── In-memory room registry (live rooms with WS connections + engines) ─────

const rooms = new Map<string, LiveRoom>();

// ─── Redis key helpers ──────────────────────────────────────────────────────

const ROOM_EXPIRY = 60; // seconds

const roomKey = (id: string) => `room:${id}`;
const userRoomKey = (userId: string) => `user-room:${userId}`;
const disconnectedPlayerKey = (roomId: string, userId: string) =>
    `disconnected:${roomId}:${userId}`;

// ─── Serialisation / Redis sync ─────────────────────────────────────────────

function serializeRoom(room: LiveRoom): string {
    return JSON.stringify({
        id: room.id,
        hostId: room.hostId,
        state: room.state,
        maxPlayers: room.maxPlayers,
        isPrivate: room.isPrivate,
        gameId: room.gameId,
        games: room.games,
        currentGameIndex: room.currentGameIndex,
        players: room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            status: p.status,
            isHost: p.isHost,
            userId: p.userId,
            avatarUrl: p.avatarUrl,
            bio: p.bio,
        })),
    });
}

/** Fire-and-forget sync of room state to Redis. */
function syncToRedis(room: LiveRoom): void {
    redis.set(roomKey(room.id), serializeRoom(room)).catch(() => { });
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export function getRoom(id: string): LiveRoom | undefined {
    return rooms.get(id);
}

export function setRoom(room: LiveRoom): void {
    rooms.set(room.id, room);
    syncToRedis(room);
}

export function deleteRoom(id: string): void {
    rooms.delete(id);
    redis.del(roomKey(id)).catch(() => { });
}

export function getAllRooms(): LiveRoom[] {
    return [...rooms.values()];
}

// ─── Redis persistence for reconnection ─────────────────────────────────────

/** Persist room to Redis with a 60 s TTL (called when all players leave). */
export function persistRoomWithTTL(room: LiveRoom): void {
    redis.set(roomKey(room.id), serializeRoom(room), "EX", ROOM_EXPIRY).catch(() => { });
}

/** Load room data from Redis (used during reconnection). */
export async function getPersistedRoom(roomId: string): Promise<Record<string, any> | null> {
    const json = await redis.get(roomKey(roomId));
    return json ? JSON.parse(json) : null;
}

/** Remove the TTL from a persisted room (someone reconnected). */
export function cancelRoomExpiry(roomId: string): void {
    redis.persist(roomKey(roomId)).catch(() => { });
}

// ─── User ↔ Room mapping ────────────────────────────────────────────────────

export function setUserRoomMapping(userId: string, roomId: string): void {
    redis.set(userRoomKey(userId), roomId, "EX", ROOM_EXPIRY).catch(() => { });
}

export async function getUserRoomId(userId: string): Promise<string | null> {
    return redis.get(userRoomKey(userId));
}

export function clearUserRoomMapping(userId: string): void {
    redis.del(userRoomKey(userId)).catch(() => { });
}

// ─── Disconnected player data ───────────────────────────────────────────────

export function saveDisconnectedPlayer(roomId: string, userId: string, player: LivePlayer): void {
    const data = JSON.stringify({
        nickname: player.nickname,
        score: player.score,
        status: player.status,
        isHost: player.isHost,
        userId: player.userId,
        avatarUrl: player.avatarUrl,
        bio: player.bio,
    });
    redis.set(disconnectedPlayerKey(roomId, userId), data, "EX", ROOM_EXPIRY).catch(() => { });
}

export async function getDisconnectedPlayer(roomId: string, userId: string): Promise<Record<string, any> | null> {
    const json = await redis.get(disconnectedPlayerKey(roomId, userId));
    return json ? JSON.parse(json) : null;
}

export function clearDisconnectedPlayer(roomId: string, userId: string): void {
    redis.del(disconnectedPlayerKey(roomId, userId)).catch(() => { });
}

// ─── Communication ──────────────────────────────────────────────────────────

/** Send a ServerMessage to every player in the room. */
export function broadcast(room: LiveRoom, msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const player of room.players) {
        try {
            player.ws.send(payload);
        } catch {
            // ignore dead sockets
        }
    }
}

/** Send to a single player. */
export function sendTo(player: LivePlayer, msg: ServerMessage): void {
    try {
        player.ws.send(JSON.stringify(msg));
    } catch {
        // ignore
    }
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

/** Serialise a LiveRoom into the plain Room shape understood by clients. */
export function roomSnapshot(room: LiveRoom): import("@izma/types").Room {
    return {
        id: room.id,
        hostId: room.hostId,
        state: room.state,
        maxPlayers: room.maxPlayers,
        isPrivate: room.isPrivate,
        gameId: room.gameId,
        games: room.games,
        currentGameIndex: room.currentGameIndex,
        gameState: (room.engine ? room.engine.getState() : null) as import("@izma/types").AnyGameState | null,
        players: room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            status: p.status,
            isHost: p.isHost,
            userId: p.userId,
            avatarUrl: p.avatarUrl,
            bio: p.bio,
        })),
    };
}

// ─── Player management ──────────────────────────────────────────────────────

/**
 * Remove a player from a room.
 * Saves disconnect data to Redis for reconnection.
 * Returns `true` when the room is now empty.
 */
export function removePlayer(room: LiveRoom, playerId: string): boolean {
    const player = room.players.find((p) => p.id === playerId);

    // Persist reconnection data for authenticated players
    if (player?.userId) {
        saveDisconnectedPlayer(room.id, player.userId, player);
        setUserRoomMapping(player.userId, room.id);
    }

    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.length === 0) {
        room.engine?.destroy();
        // Keep room in Redis with 60 s TTL instead of deleting
        persistRoomWithTTL(room);
        rooms.delete(room.id);
        return true;
    }

    // Reassign host if necessary
    if (room.hostId === playerId) {
        const newHost = room.players[0];
        if (newHost) {
            room.hostId = newHost.id;
            newHost.isHost = true;
        }
    }

    syncToRedis(room);
    return false;
}
