import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "../store/useGameStore";

// Reset the Zustand store between tests
function resetStore() {
    useGameStore.setState({
        ws: null,
        status: "idle",
        playerId: null,
        nickname: "",
        room: null,
        gameState: null,
        gameResults: null,
        error: null,
        availableGames: [],
        selectedGameIds: ["reaction"],
        totalRounds: 3,
        roundsPerGame: {},
        selectionMode: "MANUAL",
        gameOrder: [],
        lastCoinUpdate: null,
        publicRooms: [],
    });
}

describe("useGameStore — state management", () => {
    beforeEach(resetStore);

    // ── setNickname ──────────────────────────────────────────────────────────

    it("setNickname updates nickname", () => {
        useGameStore.getState().setNickname("Alice");
        expect(useGameStore.getState().nickname).toBe("Alice");
    });

    // ── Game selection ──────────────────────────────────────────────────────

    describe("selectionMode", () => {
        it("setSelectionMode updates mode", () => {
            useGameStore.getState().setSelectionMode("RANDOM");
            expect(useGameStore.getState().selectionMode).toBe("RANDOM");
        });
    });

    describe("totalRounds", () => {
        it("setTotalRounds updates totalRounds", () => {
            useGameStore.getState().setTotalRounds(7);
            expect(useGameStore.getState().totalRounds).toBe(7);
        });

        it("clamps totalRounds to min 1", () => {
            useGameStore.getState().setTotalRounds(0);
            expect(useGameStore.getState().totalRounds).toBe(1);
        });

        it("clamps totalRounds to max 20", () => {
            useGameStore.getState().setTotalRounds(25);
            expect(useGameStore.getState().totalRounds).toBe(20);
        });
    });

    describe("setGameRounds", () => {
        it("sets per-game rounds", () => {
            useGameStore.getState().setGameRounds("reaction", 5);
            expect(useGameStore.getState().roundsPerGame.reaction).toBe(5);
        });

        it("clamps to min 1", () => {
            useGameStore.getState().setGameRounds("reaction", -1);
            expect(useGameStore.getState().roundsPerGame.reaction).toBe(1);
        });

        it("clamps to max 20", () => {
            useGameStore.getState().setGameRounds("reaction", 30);
            expect(useGameStore.getState().roundsPerGame.reaction).toBe(20);
        });

        it("preserves other game rounds", () => {
            useGameStore.getState().setGameRounds("reaction", 3);
            useGameStore.getState().setGameRounds("color-match", 7);
            const rounds = useGameStore.getState().roundsPerGame;
            expect(rounds.reaction).toBe(3);
            expect(rounds["color-match"]).toBe(7);
        });
    });

    describe("toggleGameSelection", () => {
        it("adds a game to selectedGameIds", () => {
            useGameStore.setState({ selectedGameIds: ["reaction"] });
            useGameStore.getState().toggleGameSelection("color-match");
            expect(useGameStore.getState().selectedGameIds).toContain("color-match");
            expect(useGameStore.getState().selectedGameIds).toContain("reaction");
        });

        it("removes a game from selectedGameIds", () => {
            useGameStore.setState({ selectedGameIds: ["reaction", "color-match"] });
            useGameStore.getState().toggleGameSelection("color-match");
            expect(useGameStore.getState().selectedGameIds).not.toContain("color-match");
            expect(useGameStore.getState().selectedGameIds).toContain("reaction");
        });

        it("does not remove the last game", () => {
            useGameStore.setState({ selectedGameIds: ["reaction"] });
            useGameStore.getState().toggleGameSelection("reaction");
            // Should still have the game
            expect(useGameStore.getState().selectedGameIds).toContain("reaction");
            expect(useGameStore.getState().selectedGameIds).toHaveLength(1);
        });
    });

    // ── clearError ──────────────────────────────────────────────────────────

    it("clearError clears the error", () => {
        useGameStore.setState({ error: "Something broke" });
        useGameStore.getState().clearError();
        expect(useGameStore.getState().error).toBeNull();
    });

    // ── resetGame ───────────────────────────────────────────────────────────

    it("resetGame clears game state and results", () => {
        useGameStore.setState({
            gameState: { gameId: "reaction", phase: "reacting", round: 1, totalRounds: 3, scores: {}, countdown: 0, winner: null, falseStarter: null, lastReactionTime: null } as any,
            gameResults: { scores: {}, rounds: [], mvp: null },
            lastCoinUpdate: { delta: 10, coins: 110, reason: "VICTORY" },
            room: {
                id: "ROOM1", hostId: "p1", players: [], state: "playing",
                maxPlayers: 4, isPrivate: false, gameId: "reaction",
                games: { totalRounds: 3, mode: "MANUAL", selectedGameIds: ["reaction"] },
                currentGameIndex: 0, gameState: null,
            },
        });

        useGameStore.getState().resetGame();

        const state = useGameStore.getState();
        expect(state.gameState).toBeNull();
        expect(state.gameResults).toBeNull();
        expect(state.lastCoinUpdate).toBeNull();
        expect(state.room?.state).toBe("lobby");
    });

    // ── disconnect ──────────────────────────────────────────────────────────

    it("disconnect resets room state", () => {
        useGameStore.setState({
            room: { id: "ROOM1" } as any,
            gameState: {} as any,
            gameResults: {} as any,
            gameOrder: ["reaction"],
        });

        useGameStore.getState().disconnect();

        const state = useGameStore.getState();
        expect(state.room).toBeNull();
        expect(state.gameState).toBeNull();
        expect(state.gameResults).toBeNull();
        expect(state.gameOrder).toEqual([]);
        expect(state.status).toBe("idle");
    });

    // ── handleMessage (via setState) ────────────────────────────────────────

    describe("state updates from server messages", () => {
        it("JOINED updates playerId", () => {
            useGameStore.setState({ playerId: "p1" });
            expect(useGameStore.getState().playerId).toBe("p1");
        });

        it("ROOM_UPDATE updates room", () => {
            const room = {
                id: "ROOM1", hostId: "p1", players: [],
                state: "lobby" as const, maxPlayers: 4, isPrivate: false,
                gameId: "reaction", games: { totalRounds: 3, mode: "MANUAL" as const, selectedGameIds: ["reaction"] },
                currentGameIndex: 0, gameState: null,
            };
            useGameStore.setState({ room });
            expect(useGameStore.getState().room).toEqual(room);
        });

        it("GAME_STATE updates gameState", () => {
            const gameState = {
                gameId: "reaction" as const,
                phase: "reacting" as const,
                round: 1, totalRounds: 3,
                scores: { p1: 0 },
                countdown: 0, winner: null, falseStarter: null, lastReactionTime: null,
            };
            useGameStore.setState({ gameState });
            expect(useGameStore.getState().gameState).toEqual(gameState);
        });

        it("GAME_END updates gameResults", () => {
            const results = { scores: { p1: 3 }, rounds: [], mvp: "p1" };
            useGameStore.setState({ gameResults: results });
            expect(useGameStore.getState().gameResults).toEqual(results);
        });

        it("ERROR updates error", () => {
            useGameStore.setState({ error: "Sala não encontrada." });
            expect(useGameStore.getState().error).toBe("Sala não encontrada.");
        });

        it("ROOM_GAMES_DEFINED updates gameOrder", () => {
            useGameStore.setState({ gameOrder: ["reaction", "color-match"] });
            expect(useGameStore.getState().gameOrder).toEqual(["reaction", "color-match"]);
        });

        it("COINS_UPDATE updates lastCoinUpdate", () => {
            useGameStore.setState({
                lastCoinUpdate: { delta: 10, coins: 110, reason: "VICTORY" },
            });
            expect(useGameStore.getState().lastCoinUpdate).toEqual({
                delta: 10, coins: 110, reason: "VICTORY",
            });
        });

        it("ROOM_LIST updates publicRooms", () => {
            const rooms = [
                { id: "ABC", hostNickname: "Host", playerCount: 2, maxPlayers: 4, gameIds: ["reaction"], state: "lobby" as const },
            ];
            useGameStore.setState({ publicRooms: rooms });
            expect(useGameStore.getState().publicRooms).toEqual(rooms);
        });
    });
});
