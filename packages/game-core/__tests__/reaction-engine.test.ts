import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ServerMessage } from "@izma/protocol";
import type { Player } from "@izma/types";
import { ReactionGameEngine } from "../engines/reaction";

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

describe("ReactionGameEngine", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("initialises with correct default state", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 3);

        const state = engine.getState();
        expect(state.gameId).toBe("reaction");
        expect(state.phase).toBe("countdown");
        expect(state.round).toBe(0);
        expect(state.totalRounds).toBe(3);
        expect(state.scores).toEqual({ p1: 0, p2: 0 });
        expect(state.winner).toBeNull();
        expect(state.falseStarter).toBeNull();
    });

    it("runs countdown from 3 to 0 then transitions to waiting", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 3);

        engine.init();

        // Countdown: 3 → 2 → 1 → 0
        vi.advanceTimersByTime(1000); // countdown = 2
        vi.advanceTimersByTime(1000); // countdown = 1
        vi.advanceTimersByTime(1000); // countdown = 0 → starts round

        const state = engine.getState();
        expect(state.round).toBe(1);
        expect(state.phase).toBe("waiting");
    });

    it("detects false start during waiting phase", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 3);

        engine.init();

        // Complete countdown
        vi.advanceTimersByTime(3000);

        expect(engine.getState().phase).toBe("waiting");

        // Player reacts too early — false start
        engine.onPlayerAction("p1", "REACT");
        const state = engine.getState();
        expect(state.falseStarter).toBe("p1");
        expect(state.scores.p1).toBe(0); // max(0, 0-1) = 0
    });

    it("ignores non-REACT actions", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 3);

        engine.init();
        vi.advanceTimersByTime(3000);

        engine.onPlayerAction("p1", "SOMETHING_ELSE");
        const state = engine.getState();
        expect(state.falseStarter).toBeNull();
    });

    it("rewards first reactor during reacting phase", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 3);

        engine.init();

        // Complete countdown
        vi.advanceTimersByTime(3000);

        // Advance through waiting phase into reacting (max 4s delay)
        vi.advanceTimersByTime(4000);

        const stateBeforeReact = engine.getState();
        expect(stateBeforeReact.phase).toBe("reacting");

        // Player 1 reacts first
        engine.onPlayerAction("p1", "REACT");

        const state = engine.getState();
        expect(state.winner).toBe("p1");
        expect(state.scores.p1).toBe(1);
        expect(state.phase).toBe("round_result");
    });

    it("prevents double-reaction from same player", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 3);

        engine.init();
        vi.advanceTimersByTime(3000); // countdown done
        vi.advanceTimersByTime(4000); // into reacting

        engine.onPlayerAction("p1", "REACT");
        engine.onPlayerAction("p1", "REACT"); // duplicate

        // Score should still be 1, not 2
        expect(engine.getState().scores.p1).toBe(1);
    });

    it("completes all rounds and reaches game_over", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const totalRounds = 2;
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, totalRounds);

        engine.init();

        for (let r = 0; r < totalRounds; r++) {
            if (r === 0) {
                // First round: countdown 3s
                vi.advanceTimersByTime(3000);
            }
            // Waiting → reacting (max 4s)
            vi.advanceTimersByTime(4000);
            // React
            engine.onPlayerAction("p1", "REACT");
            // Round result pause (2.5s) before next round or game_over
            vi.advanceTimersByTime(2500);
        }

        const state = engine.getState();
        expect(state.phase).toBe("game_over");
        expect(state.round).toBe(totalRounds);
    });

    it("broadcasts GAME_END with results after last round", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 1);

        engine.init();
        vi.advanceTimersByTime(3000); // countdown
        vi.advanceTimersByTime(4000); // into reacting
        engine.onPlayerAction("p1", "REACT");
        vi.advanceTimersByTime(2500); // post-round pause → finishGame

        const gameEndMsg = messages.find((m) => m.type === "GAME_END");
        expect(gameEndMsg).toBeDefined();
        if (gameEndMsg?.type === "GAME_END") {
            expect(gameEndMsg.payload.mvp).toBe("p1");
            expect(gameEndMsg.payload.scores.p1).toBe(1);
        }
    });

    it("auto-ends round after 3s timeout in reacting phase", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 1);

        engine.init();
        vi.advanceTimersByTime(3000); // countdown
        vi.advanceTimersByTime(4000); // into reacting
        // No one reacts — wait 3s auto-timeout
        vi.advanceTimersByTime(3000);

        const state = engine.getState();
        expect(state.phase).toBe("round_result");
        expect(state.winner).toBeNull();
    });

    it("destroy stops game and ignores subsequent actions", () => {
        const messages: ServerMessage[] = [];
        const broadcast = (msg: ServerMessage) => messages.push(msg);
        const engine = new ReactionGameEngine(makePlayers(2), broadcast, 3);

        engine.init();
        engine.destroy();

        // Should not throw or change state after destroy
        engine.onPlayerAction("p1", "REACT");
        // Advance timers — no errors
        vi.advanceTimersByTime(10000);
    });

    it("getState returns a copy (not a reference)", () => {
        const engine = new ReactionGameEngine(makePlayers(2), () => { }, 3);
        const state1 = engine.getState();
        const state2 = engine.getState();
        expect(state1).not.toBe(state2);
        expect(state1).toEqual(state2);
    });
});
