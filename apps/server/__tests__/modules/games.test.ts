import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

import { getAvailableGames, getGameById, pickRandomGames } from "../../src/modules/games/games.service";
import { handleGetGames } from "../../src/modules/games/games.controller";
import { query } from "../../src/db";
import type { Request, Response } from "express";

const mockQuery = vi.mocked(query);

const gameRow = {
    id: "g1",
    name: "Reaction",
    description: "Test your reflexes",
    thumbnail_url: "https://cdn.test/reaction.png",
    min_players: 2,
    max_players: 6,
    is_active: true,
};

describe("games.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getAvailableGames", () => {
        it("returns mapped active games", async () => {
            mockQuery.mockResolvedValue({ rows: [gameRow], rowCount: 1 } as any);
            const games = await getAvailableGames();
            expect(games).toHaveLength(1);
            expect(games[0]).toEqual({
                id: "g1",
                name: "Reaction",
                description: "Test your reflexes",
                thumbnailUrl: "https://cdn.test/reaction.png",
                minPlayers: 2,
                maxPlayers: 6,
                isActive: true,
            });
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("WHERE is_active = true"),
            );
        });

        it("returns empty for no active games", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            expect(await getAvailableGames()).toEqual([]);
        });
    });

    describe("getGameById", () => {
        it("returns game when found", async () => {
            mockQuery.mockResolvedValue({ rows: [gameRow], rowCount: 1 } as any);
            const game = await getGameById("g1");
            expect(game?.id).toBe("g1");
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("WHERE id = $1"),
                ["g1"],
            );
        });

        it("returns undefined when not found", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            expect(await getGameById("none")).toBeUndefined();
        });
    });

    describe("pickRandomGames", () => {
        it("returns requested count of IDs", async () => {
            mockQuery.mockResolvedValue({
                rows: [gameRow, { ...gameRow, id: "g2", name: "Color" }],
                rowCount: 2,
            } as any);
            const ids = await pickRandomGames(5);
            expect(ids).toHaveLength(5);
            ids.forEach((id) => expect(["g1", "g2"]).toContain(id));
        });

        it("returns empty when no games exist", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            const ids = await pickRandomGames(3);
            expect(ids).toEqual([]);
        });
    });
});

describe("games.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("handleGetGames", () => {
        it("returns list of games as JSON", async () => {
            mockQuery.mockResolvedValue({ rows: [gameRow], rowCount: 1 } as any);
            const req = {} as Request;
            const res = {
                json: vi.fn(),
            } as unknown as Response;
            await handleGetGames(req, res);
            expect(res.json).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ id: "g1" })]),
            );
        });
    });

    describe("security", () => {
        it("uses parameterized queries for getGameById", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            await getGameById("'; DROP TABLE games; --");
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("$1"),
                ["'; DROP TABLE games; --"],
            );
        });
    });
});
