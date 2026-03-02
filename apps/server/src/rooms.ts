import type { LiveRoom, LivePlayer } from "./types.ts";
import type { ServerMessage } from "@izma/protocol";

// In-memory room registry
const rooms = new Map<string, LiveRoom>();

export function getRoom(id: string): LiveRoom | undefined {
    return rooms.get(id);
}

export function setRoom(room: LiveRoom): void {
    rooms.set(room.id, room);
}

export function deleteRoom(id: string): void {
    rooms.delete(id);
}

export function getAllRooms(): LiveRoom[] {
    return [...rooms.values()];
}

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

/** Serialise a LiveRoom into the plain Room shape understood by clients. */
export function roomSnapshot(room: LiveRoom): import("@izma/types").Room {
    return {
        id: room.id,
        hostId: room.hostId,
        state: room.state,
        maxPlayers: room.maxPlayers,
        gameId: room.gameId,
        gameState: room.engine ? room.engine.getState() : null,
        players: room.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            status: p.status,
            isHost: p.isHost,
        })),
    };
}

/** Remove a player from a room; delete room if empty, reassign host if needed. */
export function removePlayer(room: LiveRoom, playerId: string): void {
    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.length === 0) {
        room.engine?.destroy();
        deleteRoom(room.id);
        return;
    }

    // Reassign host if necessary
    if (room.hostId === playerId) {
        const newHost = room.players[0];
        if (newHost) {
            room.hostId = newHost.id;
            newHost.isHost = true;
        }
    }
}
