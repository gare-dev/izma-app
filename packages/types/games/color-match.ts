import type { BaseGameState } from "../index";

// ─── Color Match Game ───────────────────────────────────────────────────────
// A color name is shown in a DIFFERENT ink color. Players must tap the button
// matching the *text* (word), not the ink color. Fastest correct answer wins
// the round.

export type ColorMatchPhase =
    | "idle"
    | "countdown"
    | "showing"       // color is displayed — pick the right answer
    | "round_result"
    | "game_over";

export interface ColorMatchGameState extends BaseGameState {
    gameId: "color-match";
    phase: ColorMatchPhase;
    countdown: number;
    /** The color word shown on screen (e.g. "Vermelho") */
    displayWord: string | null;
    /** The ink/CSS color the word is rendered in (e.g. "#3b82f6" for blue) */
    displayColor: string | null;
    /** The answer options for this round */
    options: string[];
    /** The correct answer (color name) */
    correctAnswer: string | null;
    /** playerId who answered first correctly */
    winner: string | null;
    /** playerId who answered incorrectly first (optional feedback) */
    wrongAnswerer: string | null;
}
