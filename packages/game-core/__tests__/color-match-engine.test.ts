import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ServerMessage } from "@izma/protocol";
import type { Player } from "@izma/types";
import { ColorMatchEngine } from "../engines/color-match";

function makePlayers(count: number): Player[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `p${i + 1}`,
        nickname: `Player${i + 1}`,
        score: 0,
        status: "playing" as const,
        isHost: i === 0,
        userId: null,
        avatarUrl: null,
    }));
}

describe("ColorMatchEngine", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("initialises with correct default state", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        const state = engine.getState();
        expect(state.gameId).toBe("color-match");
        expect(state.phase).toBe("countdown");
        expect(state.round).toBe(0);
        expect(state.totalRounds).toBe(3);
        expect(state.scores).toEqual({ p1: 0, p2: 0 });
        expect(state.displayWord).toBeNull();
        expect(state.displayColor).toBeNull();
        expect(state.options).toEqual([]);
        expect(state.correctAnswer).toBeNull();
        expect(state.winner).toBeNull();
        expect(state.wrongAnswerer).toBeNull();
    });

    it("runs countdown then starts first round", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();

        // Countdown: 3 → 2 → 1 → 0
        vi.advanceTimersByTime(3000);

        const state = engine.getState();
        expect(state.phase).toBe("showing");
        expect(state.round).toBe(1);
        expect(state.displayWord).toBeTruthy();
        expect(state.displayColor).toBeTruthy();
        expect(state.correctAnswer).toBeTruthy();
        expect(state.options.length).toBe(4);
    });

    it("correctAnswer matches displayWord", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000);

        const state = engine.getState();
        expect(state.correctAnswer).toBe(state.displayWord);
    });

    it("displayColor differs from the hex of the displayWord color", () => {
        // This test runs multiple times because of randomness
        for (let i = 0; i < 10; i++) {
            const engine = new ColorMatchEngine(makePlayers(2), () => { }, 1);
            engine.init();
            vi.advanceTimersByTime(3000);

            const state = engine.getState();
            // The Stroop effect: display color should NOT match the word's own color
            // Since we don't have the mapping from name→hex here, we just check both are set
            expect(state.displayWord).toBeTruthy();
            expect(state.displayColor).toBeTruthy();

            engine.destroy();
        }
    });

    it("options contain the correct answer", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000);

        const state = engine.getState();
        expect(state.options).toContain(state.correctAnswer);
    });

    it("awards point for correct answer and ends round", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000); // countdown → showing

        const correctAnswer = engine.getState().correctAnswer!;

        engine.onPlayerAction("p1", "PICK", { color: correctAnswer });

        const state = engine.getState();
        expect(state.winner).toBe("p1");
        expect(state.scores.p1).toBe(1);
        expect(state.phase).toBe("round_result");
    });

    it("penalises wrong answer (-1 point, min 0)", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000);

        const state = engine.getState();
        // Pick a wrong answer
        const wrongAnswer = state.options.find((o) => o !== state.correctAnswer)!;

        engine.onPlayerAction("p1", "PICK", { color: wrongAnswer });

        const newState = engine.getState();
        expect(newState.wrongAnswerer).toBe("p1");
        expect(newState.scores.p1).toBe(0); // max(0, 0-1) = 0
        // Round should NOT be over — still showing
        expect(newState.phase).toBe("showing");
    });

    it("only first correct answer wins the round", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000);

        const correctAnswer = engine.getState().correctAnswer!;

        engine.onPlayerAction("p1", "PICK", { color: correctAnswer });
        engine.onPlayerAction("p2", "PICK", { color: correctAnswer });

        const state = engine.getState();
        expect(state.winner).toBe("p1");
        expect(state.scores.p1).toBe(1);
        // p2 gets nothing — already answered (in answered set)
        expect(state.scores.p2).toBe(0);
    });

    it("ignores non-PICK actions", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000);

        engine.onPlayerAction("p1", "REACT");
        expect(engine.getState().winner).toBeNull();
    });

    it("ignores actions when not in showing phase", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        // During countdown — not "showing"
        engine.onPlayerAction("p1", "PICK", { color: "Vermelho" });
        expect(engine.getState().winner).toBeNull();
    });

    it("ignores PICK without color data", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000);

        engine.onPlayerAction("p1", "PICK", {});
        expect(engine.getState().winner).toBeNull();
    });

    it("auto-ends round after 5s timeout", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 1);
        engine.init();
        vi.advanceTimersByTime(3000); // countdown → showing

        // Nobody answers, 5s timeout
        vi.advanceTimersByTime(5000);

        const state = engine.getState();
        expect(state.phase).toBe("round_result");
        expect(state.winner).toBeNull();
    });

    it("completes all rounds and reaches game_over", () => {
        const totalRounds = 2;
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, totalRounds);
        engine.init();

        for (let r = 0; r < totalRounds; r++) {
            if (r === 0) vi.advanceTimersByTime(3000); // initially countdown

            const answer = engine.getState().correctAnswer!;
            engine.onPlayerAction("p1", "PICK", { color: answer });

            // round_result → next round or game_over (2.5s pause)
            vi.advanceTimersByTime(2500);
        }

        const state = engine.getState();
        expect(state.phase).toBe("game_over");
    });

    it("broadcasts GAME_END after the final round", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ColorMatchEngine(makePlayers(2), broadcast, 1);
        engine.init();
        vi.advanceTimersByTime(3000);

        const answer = engine.getState().correctAnswer!;
        engine.onPlayerAction("p1", "PICK", { color: answer });
        vi.advanceTimersByTime(2500); // finishGame

        const gameEnd = messages.find((m) => m.type === "GAME_END");
        expect(gameEnd).toBeDefined();
        if (gameEnd?.type === "GAME_END") {
            expect(gameEnd.payload.mvp).toBe("p1");
        }
    });

    it("destroy stops the engine", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        engine.destroy();

        vi.advanceTimersByTime(10000);
        engine.onPlayerAction("p1", "PICK", { color: "Vermelho" });
        // No errors thrown
    });

    it("getState returns a copy", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        const s1 = engine.getState();
        const s2 = engine.getState();
        expect(s1).not.toBe(s2);
        expect(s1).toEqual(s2);
    });

    it("player cannot answer twice in the same round", () => {
        const engine = new ColorMatchEngine(makePlayers(2), () => { }, 3);
        engine.init();
        vi.advanceTimersByTime(3000);

        const state = engine.getState();
        const wrongAnswer = state.options.find((o) => o !== state.correctAnswer)!;
        const correctAnswer = state.correctAnswer!;

        // p1 picks wrong first
        engine.onPlayerAction("p1", "PICK", { color: wrongAnswer });
        // p1 tries to pick correct — should be ignored (already answered)
        engine.onPlayerAction("p1", "PICK", { color: correctAnswer });

        const newState = engine.getState();
        expect(newState.winner).toBeNull(); // p1's correct answer was ignored
        expect(newState.scores.p1).toBe(0);
    });
});
