import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

import { getAvailableGames, getGameById, pickRandomGames } from "../../src/modules/games/games.service";
import { query } from "../../src/db";

const mockQuery = vi.mocked(query);

const sampleRows = [
    { id: "reaction", name: "Reaction", description: "React fast!", thumbnail_url: "/r.png", min_players: 2, max_players: 8, is_active: true },
    { id: "color-match", name: "Color Match", description: "Match colors", thumbnail_url: "/c.png", min_players: 2, max_players: 8, is_active: true },
];

describe("games.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getAvailableGames", () => {
        it("returns mapped Game objects", async () => {
            mockQuery.mockResolvedValue({ rows: sampleRows, rowCount: 2 } as any);

            const games = await getAvailableGames();
            expect(games).toHaveLength(2);
            expect(games[0]).toEqual({
                id: "reaction",
                name: "Reaction",
                description: "React fast!",
                thumbnailUrl: "/r.png",
                minPlayers: 2,
                maxPlayers: 8,
                isActive: true,
            });
        });

        it("returns empty array when no games", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            const games = await getAvailableGames();
            expect(games).toEqual([]);
        });
    });

    describe("getGameById", () => {
        it("returns a game when found", async () => {
            mockQuery.mockResolvedValue({ rows: [sampleRows[0]], rowCount: 1 } as any);
            const game = await getGameById("reaction");
            expect(game).toBeDefined();
            expect(game!.id).toBe("reaction");
        });

        it("returns undefined when not found", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            const game = await getGameById("nonexistent");
            expect(game).toBeUndefined();
        });

        it("passes the id as parameterised query", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            await getGameById("reaction");
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("WHERE id = $1"),
                ["reaction"],
            );
        });
    });

    describe("pickRandomGames", () => {
        it("returns the requested count of game IDs", async () => {
            mockQuery.mockResolvedValue({ rows: sampleRows, rowCount: 2 } as any);
            const ids = await pickRandomGames(3);
            expect(ids).toHaveLength(3);
            for (const id of ids) {
                expect(["reaction", "color-match"]).toContain(id);
            }
        });

        it("returns empty array when no games available", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            const ids = await pickRandomGames(3);
            expect(ids).toEqual([]);
        });

        it("returns single game when count is 1", async () => {
            mockQuery.mockResolvedValue({ rows: sampleRows, rowCount: 2 } as any);
            const ids = await pickRandomGames(1);
            expect(ids).toHaveLength(1);
        });
    });
});
