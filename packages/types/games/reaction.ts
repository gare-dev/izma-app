import type { BaseGameState } from "../index";

// ─── Reaction Game ──────────────────────────────────────────────────────────

export type ReactionPhase =
    | "idle"
    | "countdown"
    | "waiting"   // before signal – don't click
    | "reacting"  // signal shown – click now!
    | "round_result"
    | "game_over";

export interface ReactionGameState extends BaseGameState {
    gameId: "reaction";
    phase: ReactionPhase;
    countdown: number;         // seconds remaining in pre-game countdown
    winner: string | null;     // playerId who won this round
    falseStarter: string | null; // playerId who clicked too early
    lastReactionTime: number | null; // ms, winner's reaction time this round
}
