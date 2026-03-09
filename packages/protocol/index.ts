import type { Room, AnyGameState, RoomGameSettings, PublicRoomInfo } from "@izma/types";

// ─── Client → Server ───────────────────────────────────────────────────────

export type ClientMessage =
    | { type: "CREATE_ROOM"; payload: { nickname: string; maxPlayers: number; gameId: string; games: RoomGameSettings; isPrivate?: boolean } }
    | { type: "JOIN_ROOM"; payload: { roomId: string; nickname: string } }
    | { type: "JOIN_RANDOM"; payload: { nickname: string } }
    | { type: "LIST_ROOMS" }
    | { type: "SET_READY" }
    | { type: "START_GAME" }
    | { type: "PLAYER_ACTION"; payload: { action: string; data?: unknown } }
    /** Sent right after WS connect if the user has a JWT */
    | { type: "AUTH"; payload: { token: string } }
    /** Attempt to rejoin a room after disconnect / page reload */
    | { type: "RECONNECT" }
    /** Global lobby chat */
    | { type: "GLOBAL_CHAT"; payload: { message: string } }
    /** Room chat */
    | { type: "ROOM_CHAT"; payload: { message: string } }
    /** Clan chat */
    | { type: "CLAN_CHAT"; payload: { clanId: string; message: string } }
    /** Subscribe / unsubscribe from clan chat room */
    | { type: "CLAN_CHAT_JOIN"; payload: { clanId: string } }
    | { type: "CLAN_CHAT_LEAVE"; payload: { clanId: string } };

// ─── Server → Client ───────────────────────────────────────────────────────

export type RoundResult = {
    round: number;
    winnerId: string | null;
    // Reaction-game specific (optional so other games don't need them)
    reactionTime?: number | null;
    falseStarterId?: string | null;
};

export type GameResults = {
    scores: Record<string, number>;
    rounds: RoundResult[];
    mvp: string | null; // playerId with highest score
};

export type ServerMessage =
    | { type: "JOINED"; payload: { playerId: string; roomId: string } }
    | { type: "ROOM_UPDATE"; payload: { room: Room } }
    | { type: "GAME_STATE"; payload: { gameState: AnyGameState } }
    | { type: "GAME_END"; payload: GameResults }
    | { type: "ERROR"; payload: { message: string } }
    /** Confirms the user is authenticated over this WS */
    | { type: "AUTH_OK"; payload: { userId: string; username: string } }
    /** Sent once after START_GAME so every client knows the planned game order */
    | { type: "ROOM_GAMES_DEFINED"; payload: { totalRounds: number; gameOrder: string[] } }
    /** Notifies coin reward at end of match */
    | { type: "COINS_UPDATE"; payload: { userId: string; coins: number; delta: number; reason: string } }
    /** List of public rooms in lobby state */
    | { type: "ROOM_LIST"; payload: { rooms: PublicRoomInfo[] } }
    /** Room chat message */
    | { type: "ROOM_CHAT_MESSAGE"; payload: { playerId: string; username: string; avatarUrl: string | null; bio: string | null; message: string; timestamp: number } }
    /** Global lobby chat message */
    | { type: "GLOBAL_CHAT_MESSAGE"; payload: { id: string; userId: string | null; username: string; avatarUrl: string | null; bio: string | null; message: string; timestamp: number } }
    /** Clan chat message */
    | { type: "CLAN_CHAT_MESSAGE"; payload: { id: string; clanId: string; userId: string; username: string; avatarUrl: string | null; message: string; timestamp: string } };

// ─── Helpers ────────────────────────────────────────────────────────────────

export function parseClientMessage(raw: string): ClientMessage | null {
    try {
        return JSON.parse(raw) as ClientMessage;
    } catch {
        return null;
    }
}

export function serializeServerMessage(msg: ServerMessage): string {
    return JSON.stringify(msg);
}
