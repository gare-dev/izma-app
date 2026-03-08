import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

import { getTopCoins, getTopVictories } from "../../src/modules/rankings/rankings.service";
import { query } from "../../src/db";

const mockQuery = vi.mocked(query);

describe("rankings.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getTopCoins", () => {
        it("returns ranked users from DB", async () => {
            mockQuery.mockResolvedValue({
                rows: [
                    { user_id: "u1", username: "Alice", avatar_url: null, value: 500 },
                    { user_id: "u2", username: "Bob", avatar_url: "/bob.png", value: 300 },
                ],
                rowCount: 2,
            } as any);

            const ranked = await getTopCoins();
            expect(ranked).toHaveLength(2);
            expect(ranked[0]).toEqual({
                rank: 1,
                userId: "u1",
                username: "Alice",
                avatarUrl: null,
                value: 500,
            });
            expect(ranked[1]!.rank).toBe(2);
        });

        it("returns empty array when no users", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);
            const ranked = await getTopCoins();
            expect(ranked).toEqual([]);
        });
    });

    describe("getTopVictories", () => {
        it("calls DB with daily filter", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

            await getTopVictories("daily");

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("1 day"),
                expect.anything(),
            );
        });

        it("calls DB with weekly filter", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

            await getTopVictories("weekly");

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("7 days"),
                expect.anything(),
            );
        });

        it("calls DB with monthly filter", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

            await getTopVictories("monthly");

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("30 days"),
                expect.anything(),
            );
        });

        it("calls DB without period filter for all-time", async () => {
            mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

            await getTopVictories("all");

            // The query should NOT contain a date filter
            const callArg = mockQuery.mock.calls[0]![0] as string;
            expect(callArg).not.toContain("INTERVAL");
        });

        it("returns mapped RankedUser objects", async () => {
            mockQuery.mockResolvedValue({
                rows: [
                    { user_id: "u1", username: "Winner", avatar_url: null, value: 15 },
                ],
                rowCount: 1,
            } as any);

            const ranked = await getTopVictories("all");
            expect(ranked[0]).toEqual({
                rank: 1,
                userId: "u1",
                username: "Winner",
                avatarUrl: null,
                value: 15,
            });
        });
    });
});
