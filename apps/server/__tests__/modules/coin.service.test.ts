import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB and Redis
vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

vi.mock("../../src/redis.ts", () => ({
    redis: {
        del: vi.fn().mockResolvedValue(1),
    },
}));

// Mock auth service functions used by coin.service
vi.mock("../../src/modules/auth/auth.service.ts", () => ({
    addCoinsToUser: vi.fn(),
    getUserBalance: vi.fn(),
}));

import { awardCoins, getBalance, COINS } from "../../src/modules/coins/coin.service";
import { addCoinsToUser, getUserBalance } from "../../src/modules/auth/auth.service";
import { query } from "../../src/db";

const mockAddCoins = vi.mocked(addCoinsToUser);
const mockGetBalance = vi.mocked(getUserBalance);
const mockQuery = vi.mocked(query);

describe("coin.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("COINS constants", () => {
        it("defines VICTORY as 10", () => {
            expect(COINS.VICTORY).toBe(10);
        });

        it("defines PARTICIPATION as 2", () => {
            expect(COINS.PARTICIPATION).toBe(2);
        });
    });

    describe("awardCoins", () => {
        it("awards VICTORY coins correctly", async () => {
            mockAddCoins.mockResolvedValue(110);
            mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

            const result = await awardCoins("user1", "VICTORY", "room1");

            expect(result).not.toBeNull();
            expect(result!.delta).toBe(10);
            expect(result!.newBalance).toBe(110);
            expect(result!.reason).toBe("VICTORY");
            expect(result!.userId).toBe("user1");
        });

        it("awards PARTICIPATION coins correctly", async () => {
            mockAddCoins.mockResolvedValue(102);
            mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

            const result = await awardCoins("user2", "PARTICIPATION", "room1");

            expect(result).not.toBeNull();
            expect(result!.delta).toBe(2);
            expect(result!.newBalance).toBe(102);
        });

        it("returns null when user is guest (addCoinsToUser returns null)", async () => {
            mockAddCoins.mockResolvedValue(null);

            const result = await awardCoins("guest1", "VICTORY", "room1");
            expect(result).toBeNull();
        });

        it("inserts a coin_transaction record", async () => {
            mockAddCoins.mockResolvedValue(100);
            mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

            await awardCoins("user1", "VICTORY", "room1");

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("INSERT INTO coin_transactions"),
                ["user1", 10, "VICTORY", "room1"],
            );
        });
    });

    describe("getBalance", () => {
        it("returns balance from getUserBalance", async () => {
            mockGetBalance.mockResolvedValue(250);
            const balance = await getBalance("user1");
            expect(balance).toBe(250);
        });

        it("returns null for guests", async () => {
            mockGetBalance.mockResolvedValue(null);
            const balance = await getBalance("guest1");
            expect(balance).toBeNull();
        });
    });
});
