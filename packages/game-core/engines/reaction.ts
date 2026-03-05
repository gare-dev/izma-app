import type { Player, ReactionGameState } from "@izma/types";
import type { ServerMessage, GameResults, RoundResult } from "@izma/protocol";
import { registerEngine, type BroadcastFn } from "../registry";
import type { GameEngine } from "../registry";

// ─── Reaction Game Engine ───────────────────────────────────────────────────

export class ReactionGameEngine implements GameEngine {
    readonly gameId = "reaction";
    private state: ReactionGameState;
    private signalTimer: ReturnType<typeof setTimeout> | null = null;
    private roundTimer: ReturnType<typeof setTimeout> | null = null;
    private countdownTimer: ReturnType<typeof setInterval> | null = null;
    private reacted: Map<string, number> = new Map(); // playerId → reactionTime ms
    private rounds: RoundResult[] = [];
    private destroyed = false;

    constructor(
        private players: Player[],
        private broadcast: BroadcastFn,
        private readonly totalRounds = 5,
    ) {
        this.state = {
            gameId: "reaction",
            round: 0,
            totalRounds,
            phase: "countdown",
            countdown: 3,
            winner: null,
            falseStarter: null,
            scores: Object.fromEntries(players.map((p) => [p.id, 0])),
            lastReactionTime: null,
        };
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    init() {
        this.runCountdown();
    }

    onPlayerAction(playerId: string, action: string) {
        if (this.destroyed) return;
        if (action !== "REACT") return;

        if (this.state.phase === "waiting") {
            // False start
            this.state.falseStarter = playerId;
            this.state.scores[playerId] = Math.max(0, (this.state.scores[playerId] ?? 0) - 1);
            this.broadcastState();
        } else if (this.state.phase === "reacting" && !this.reacted.has(playerId)) {
            const reactionTime = Date.now() - (this._signalTimestamp ?? Date.now());
            this.reacted.set(playerId, reactionTime);

            // First to react wins the round
            if (this.reacted.size === 1) {
                this.state.winner = playerId;
                this.state.lastReactionTime = reactionTime;
                this.state.scores[playerId] = (this.state.scores[playerId] ?? 0) + 1;
                this._clearTimers();
                this.endRound();
            }
        }
    }

    getState(): ReactionGameState {
        return { ...this.state };
    }

    destroy() {
        this.destroyed = true;
        this._clearTimers();
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private _signalTimestamp: number | null = null;

    private broadcastState() {
        this.broadcast({ type: "GAME_STATE", payload: { gameState: { ...this.state } } });
    }

    private _clearTimers() {
        if (this.signalTimer) clearTimeout(this.signalTimer);
        if (this.roundTimer) clearTimeout(this.roundTimer);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.signalTimer = null;
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
        this.state.phase = "waiting";
        this.state.winner = null;
        this.state.falseStarter = null;
        this.state.lastReactionTime = null;
        this.reacted.clear();
        this._signalTimestamp = null;
        this.broadcastState();

        // Random 1–4 s delay before signal
        const delay = 1000 + Math.random() * 3000;
        this.signalTimer = setTimeout(() => {
            if (this.destroyed) return;
            this.state.phase = "reacting";
            this._signalTimestamp = Date.now();
            this.broadcastState();

            // Auto-close round after 3 s if nobody reacted
            this.roundTimer = setTimeout(() => {
                if (this.destroyed) return;
                this.endRound();
            }, 3000);
        }, delay);
    }

    private endRound() {
        if (this.destroyed) return;
        this.state.phase = "round_result";
        this.rounds.push({
            round: this.state.round,
            winnerId: this.state.winner,
            reactionTime: this.state.lastReactionTime,
            falseStarterId: this.state.falseStarter,
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

        // Determine MVP
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

registerEngine("reaction", (players, broadcast, totalRounds) =>
    new ReactionGameEngine(players, broadcast, totalRounds),
);
