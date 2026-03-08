import type { Player, ColorMatchGameState } from "@izma/types";
import type { ServerMessage, GameResults, RoundResult } from "@izma/protocol";
import { registerEngine, type BroadcastFn } from "../registry";
import type { GameEngine } from "../registry";

// ─── Color definitions ──────────────────────────────────────────────────────

const COLORS: { name: string; hex: string }[] = [
    { name: "Vermelho", hex: "#ef4444" },
    { name: "Azul", hex: "#3b82f6" },
    { name: "Verde", hex: "#22c55e" },
    { name: "Amarelo", hex: "#eab308" },
    { name: "Roxo", hex: "#a855f7" },
    { name: "Laranja", hex: "#f97316" },
];

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
}

// ─── Color Match Game Engine ────────────────────────────────────────────────

export class ColorMatchEngine implements GameEngine {
    readonly gameId = "color-match";
    private state: ColorMatchGameState;
    private roundTimer: ReturnType<typeof setTimeout> | null = null;
    private countdownTimer: ReturnType<typeof setInterval> | null = null;
    private answered: Set<string> = new Set();
    private rounds: RoundResult[] = [];
    private destroyed = false;

    constructor(
        private players: Player[],
        private broadcast: BroadcastFn,
        private readonly totalRounds = 5,
    ) {
        this.state = {
            gameId: "color-match",
            round: 0,
            totalRounds,
            phase: "countdown",
            countdown: 3,
            displayWord: null,
            displayColor: null,
            options: [],
            correctAnswer: null,
            winner: null,
            wrongAnswerer: null,
            scores: Object.fromEntries(players.map((p) => [p.id, 0])),
        };
    }

    init() {
        this.runCountdown();
    }

    onPlayerAction(playerId: string, action: string, data?: unknown) {
        if (this.destroyed) return;
        if (action !== "PICK") return;
        if (this.state.phase !== "showing") return;
        if (this.answered.has(playerId)) return;

        const chosen = (data as { color: string })?.color;
        if (!chosen) return;

        this.answered.add(playerId);

        if (chosen === this.state.correctAnswer) {
            // Correct — first correct wins the round
            if (!this.state.winner) {
                this.state.winner = playerId;
                this.state.scores[playerId] = (this.state.scores[playerId] ?? 0) + 1;
                this._clearTimers();
                this.endRound();
            }
        } else {
            // Wrong answer — penalty
            if (!this.state.wrongAnswerer) {
                this.state.wrongAnswerer = playerId;
            }
            this.state.scores[playerId] = Math.max(0, (this.state.scores[playerId] ?? 0) - 1);
            this.broadcastState();
        }
    }

    getState(): ColorMatchGameState {
        return { ...this.state };
    }

    destroy() {
        this.destroyed = true;
        this._clearTimers();
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private broadcastState() {
        this.broadcast({ type: "GAME_STATE", payload: { gameState: { ...this.state } } });
    }

    private _clearTimers() {
        if (this.roundTimer) clearTimeout(this.roundTimer);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.roundTimer = null;
        this.countdownTimer = null;
    }

    private runCountdown() {
        this.state.phase = "countdown";
        this.state.countdown = 3;
        this.broadcastState();

        this.countdownTimer = setInterval(() => {
            if (this.destroyed) return;
            this.state.countdown--;
            this.broadcastState();
            if (this.state.countdown <= 0) {
                this._clearTimers();
                this.startRound();
            }
        }, 1000);
    }

    private startRound() {
        if (this.destroyed) return;
        this.state.round++;
        this.state.phase = "showing";
        this.state.winner = null;
        this.state.wrongAnswerer = null;
        this.answered.clear();

        // Pick the correct answer (the WORD shown) and a different ink color
        const correctColor = pickRandom(COLORS);
        let inkColor = pickRandom(COLORS);
        while (inkColor.name === correctColor.name) {
            inkColor = pickRandom(COLORS);
        }

        // Build 4 shuffled options including the correct answer
        const otherColors = COLORS.filter((c) => c.name !== correctColor.name);
        const distractors = shuffle(otherColors).slice(0, 3);
        const options = shuffle([correctColor, ...distractors]).map((c) => c.name);

        this.state.displayWord = correctColor.name;
        this.state.displayColor = inkColor.hex;
        this.state.correctAnswer = correctColor.name;
        this.state.options = options;
        this.broadcastState();

        // Auto-close round after 5s if nobody answered correctly
        this.roundTimer = setTimeout(() => {
            if (this.destroyed) return;
            this.endRound();
        }, 5000);
    }

    private endRound() {
        if (this.destroyed) return;
        this.state.phase = "round_result";
        this.rounds.push({
            round: this.state.round,
            winnerId: this.state.winner,
        });
        this.broadcastState();

        if (this.state.round >= this.totalRounds) {
            setTimeout(() => this.finishGame(), 2500);
        } else {
            setTimeout(() => this.startRound(), 2500);
        }
    }

    private finishGame() {
        if (this.destroyed) return;
        this.state.phase = "game_over";
        this.broadcastState();

        let mvp: string | null = null;
        let best = -1;
        for (const [id, score] of Object.entries(this.state.scores)) {
            if (score > best) {
                best = score;
                mvp = id;
            }
        }

        const results: GameResults = {
            scores: { ...this.state.scores },
            rounds: this.rounds,
            mvp,
        };
        this.broadcast({ type: "GAME_END", payload: results });
    }
}

// ─── Auto-register ──────────────────────────────────────────────────────────

registerEngine("color-match", (players, broadcast, totalRounds) =>
    new ColorMatchEngine(players, broadcast, totalRounds),
);
