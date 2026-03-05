import type { Room, AnyGameState, RoomGameSettings } from "@izma/types";

// ─── Client → Server ───────────────────────────────────────────────────────

export type ClientMessage =
    | { type: "CREATE_ROOM"; payload: { nickname: string; maxPlayers: number; gameId: string; games: RoomGameSettings } }
    | { type: "JOIN_ROOM"; payload: { roomId: string; nickname: string } }
    | { type: "SET_READY" }
    | { type: "START_GAME" }
    | { type: "PLAYER_ACTION"; payload: { action: string; data?: unknown } }
    /** Sent right after WS connect if the user has a JWT */
    | { type: "AUTH"; payload: { token: string } };

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
    | { type: "COINS_UPDATE"; payload: { userId: string; coins: number; delta: number; reason: string } };

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
