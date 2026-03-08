import { describe, it, expect, vi } from "vitest";

// Mock DB so the module can be imported without a real connection
vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

import { toPublicUser } from "../../src/modules/auth/auth.service";

describe("toPublicUser", () => {
    it("strips sensitive fields from User", () => {
        const user = {
            id: "u1",
            username: "alice",
            email: "alice@example.com",
            passwordHash: "$2b$10$somehash",
            avatarUrl: "https://cdn.example.com/avatar.png",
            bio: "Hello!",
            coins: 42,
            isGuest: false as const,
            createdAt: "2025-01-01T00:00:00.000Z",
        };

        const pub = toPublicUser(user);

        expect(pub).toEqual({
            id: "u1",
            username: "alice",
            avatarUrl: "https://cdn.example.com/avatar.png",
            bio: "Hello!",
            coins: 42,
        });
    });

    it("does not include email", () => {
        const user = {
            id: "u2",
            username: "bob",
            email: "bob@test.com",
            passwordHash: "hash",
            avatarUrl: null,
            bio: null,
            coins: 0,
            isGuest: false as const,
            createdAt: "2025-01-01T00:00:00.000Z",
        };

        const pub = toPublicUser(user);
        expect(pub).not.toHaveProperty("email");
        expect(pub).not.toHaveProperty("passwordHash");
        expect(pub).not.toHaveProperty("isGuest");
        expect(pub).not.toHaveProperty("createdAt");
    });

    it("preserves null avatar and bio", () => {
        const user = {
            id: "u3",
            username: "carol",
            email: "carol@test.com",
            passwordHash: "hash",
            avatarUrl: null,
            bio: null,
            coins: 100,
            isGuest: false as const,
            createdAt: "2025-06-01T00:00:00.000Z",
        };

        const pub = toPublicUser(user);
        expect(pub.avatarUrl).toBeNull();
        expect(pub.bio).toBeNull();
    });
});
