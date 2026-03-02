// ─── Player ────────────────────────────────────────────────────────────────

export type PlayerStatus = "waiting" | "ready" | "playing" | "finished";

export interface Player {
    id: string;
    nickname: string;
    score: number;
    status: PlayerStatus;
    isHost: boolean;
}

// ─── Room ──────────────────────────────────────────────────────────────────

export type RoomState = "lobby" | "countdown" | "playing" | "finished";

export interface Room {
    id: string;
    hostId: string;
    players: Player[];
    state: RoomState;
    maxPlayers: number;
    gameId: string;
    gameState: ReactionGameState | null;
}

// ─── Reaction Game ──────────────────────────────────────────────────────────

export type ReactionPhase =
    | "idle"
    | "countdown"
    | "waiting"   // before signal – don't click
    | "reacting"  // signal shown – click now!
    | "round_result"
    | "game_over";

export interface ReactionGameState {
    round: number;
    totalRounds: number;
    phase: ReactionPhase;
    countdown: number;         // seconds remaining in pre-game countdown
    winner: string | null;     // playerId who won this round
    falseStarter: string | null; // playerId who clicked too early
    scores: Record<string, number>;
    lastReactionTime: number | null; // ms, winner's reaction time this round
}
