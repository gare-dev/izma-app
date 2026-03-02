import type { Room, ReactionGameState } from "@izma/types";

// ─── Client → Server ───────────────────────────────────────────────────────

export type ClientMessage =
    | { type: "CREATE_ROOM"; payload: { nickname: string; maxPlayers: number; gameId: string } }
    | { type: "JOIN_ROOM"; payload: { roomId: string; nickname: string } }
    | { type: "SET_READY" }
    | { type: "START_GAME" }
    | { type: "PLAYER_ACTION"; payload: { action: string; data?: unknown } };

// ─── Server → Client ───────────────────────────────────────────────────────

export type RoundResult = {
    round: number;
    winnerId: string | null;
    reactionTime: number | null;
    falseStarterId: string | null;
};

export type GameResults = {
    scores: Record<string, number>;
    rounds: RoundResult[];
    mvp: string | null; // playerId with highest score
};

export type ServerMessage =
    | { type: "JOINED"; payload: { playerId: string; roomId: string } }
    | { type: "ROOM_UPDATE"; payload: { room: Room } }
    | { type: "GAME_STATE"; payload: { gameState: ReactionGameState } }
    | { type: "GAME_END"; payload: GameResults }
    | { type: "ERROR"; payload: { message: string } };

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
