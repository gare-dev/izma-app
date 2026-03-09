import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

vi.mock("../../src/modules/auth/password.service.ts", () => ({
    hashPassword: vi.fn().mockResolvedValue("$hashed$"),
    comparePassword: vi.fn(),
}));

vi.mock("../../src/modules/auth/jwt.service.ts", () => ({
    signToken: vi.fn().mockResolvedValue("access-token"),
    signRefreshToken: vi.fn().mockResolvedValue("refresh-token"),
    verifyToken: vi.fn(),
    invalidateToken: vi.fn().mockResolvedValue(undefined),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
}));

import {
    toPublicUser,
    validateRegister,
    validateLogin,
    validateGuest,
    register,
    login,
    createGuest,
    refreshAccessToken,
    logout,
    getUserById,
    updateUser,
    addCoinsToUser,
    getUserBalance,
} from "../../src/modules/auth/auth.service";
import { query } from "../../src/db";
import { comparePassword } from "../../src/modules/auth/password.service";
import { verifyToken, invalidateToken, revokeRefreshToken } from "../../src/modules/auth/jwt.service";

const mockQuery = vi.mocked(query);
const mockCompare = vi.mocked(comparePassword);
const mockVerify = vi.mocked(verifyToken);
const mockInvalidate = vi.mocked(invalidateToken);
const mockRevoke = vi.mocked(revokeRefreshToken);

// ─── Helpers ────────────────────────────────────────────────────────────────

const userRow = {
    id: "u1",
    username: "alice",
    email: "alice@test.com",
    password_hash: "$hashed$",
    avatar_url: null,
    bio: null,
    coins: 100,
    is_guest: false,
    created_at: "2025-01-01T00:00:00.000Z",
};

describe("auth.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // toPublicUser
    // ═════════════════════════════════════════════════════════════════════════

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

        it("does not include email or passwordHash", () => {
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

    // ═════════════════════════════════════════════════════════════════════════
    // validateRegister
    // ═════════════════════════════════════════════════════════════════════════

    describe("validateRegister", () => {
        it("fails when username is empty", async () => {
            const result = await validateRegister({ username: "", email: "a@b.com", password: "123456" });
            expect(result.ok).toBe(false);
        });

        it("fails when username is too short", async () => {
            const result = await validateRegister({ username: "ab", email: "a@b.com", password: "123456" });
            expect(result.ok).toBe(false);
        });

        it("fails when username exceeds 20 chars", async () => {
            const result = await validateRegister({ username: "a".repeat(21), email: "a@b.com", password: "123456" });
            expect(result.ok).toBe(false);
        });

        it("fails with invalid email", async () => {
            const result = await validateRegister({ username: "alice", email: "not-an-email", password: "123456" });
            expect(result.ok).toBe(false);
        });

        it("fails when password is too short", async () => {
            const result = await validateRegister({ username: "alice", email: "a@b.com", password: "12345" });
            expect(result.ok).toBe(false);
        });

        it("fails when username already exists", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{}], rowCount: 1 } as any);

            const result = await validateRegister({ username: "alice", email: "a@b.com", password: "123456" });
            expect(result.ok).toBe(false);
            expect(result.message).toContain("Username");
        });

        it("fails when email already exists", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
                .mockResolvedValueOnce({ rows: [{}], rowCount: 1 } as any);

            const result = await validateRegister({ username: "alice", email: "a@b.com", password: "123456" });
            expect(result.ok).toBe(false);
            expect(result.message).toContain("mail");
        });

        it("passes with valid unique data", async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
                .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

            const result = await validateRegister({ username: "alice", email: "a@b.com", password: "123456" });
            expect(result.ok).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // validateLogin
    // ═════════════════════════════════════════════════════════════════════════

    describe("validateLogin", () => {
        it("fails when username is empty", () => {
            expect(validateLogin({ username: "", password: "abc" }).ok).toBe(false);
        });

        it("fails when password is empty", () => {
            expect(validateLogin({ username: "alice", password: "" }).ok).toBe(false);
        });

        it("passes with valid data", () => {
            expect(validateLogin({ username: "alice", password: "123456" }).ok).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // validateGuest
    // ═════════════════════════════════════════════════════════════════════════

    describe("validateGuest", () => {
        it("fails when username is empty", () => {
            expect(validateGuest({ username: "" }).ok).toBe(false);
        });

        it("fails when username exceeds 20 chars", () => {
            expect(validateGuest({ username: "a".repeat(21) }).ok).toBe(false);
        });

        it("passes with valid short username", () => {
            expect(validateGuest({ username: "Player1" }).ok).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // register
    // ═════════════════════════════════════════════════════════════════════════

    describe("register", () => {
        it("inserts user and returns public user with tokens", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);

            const result = await register({ username: "alice", email: "a@b.com", password: "123456" });

            expect(result.user).toHaveProperty("id");
            expect(result.user).toHaveProperty("username");
            expect(result.user).not.toHaveProperty("passwordHash");
            expect(result.accessToken).toBe("access-token");
            expect(result.refreshToken).toBe("refresh-token");
        });

        it("uses parameterized query (security: no SQL injection)", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);

            await register({ username: "alice'; DROP TABLE users;--", email: "a@b.com", password: "pass123" });

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("$1"),
                expect.arrayContaining([expect.any(String)]),
            );
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // login
    // ═════════════════════════════════════════════════════════════════════════

    describe("login", () => {
        it("returns null when user not found", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

            const result = await login({ username: "nobody", password: "123456" });
            expect(result).toBeNull();
        });

        it("returns null when password doesn't match", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);
            mockCompare.mockResolvedValue(false);

            const result = await login({ username: "alice", password: "wrong" });
            expect(result).toBeNull();
        });

        it("returns user + tokens on successful login", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);
            mockCompare.mockResolvedValue(true);

            const result = await login({ username: "alice", password: "correct" });

            expect(result).not.toBeNull();
            expect(result!.user).toHaveProperty("id");
            expect(result!.user).not.toHaveProperty("passwordHash");
            expect(result!.accessToken).toBe("access-token");
            expect(result!.refreshToken).toBe("refresh-token");
        });

        it("does not reveal whether user exists on wrong password (same null return)", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);
            mockCompare.mockResolvedValue(false);

            const wrongPassword = await login({ username: "alice", password: "wrong" });

            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
            const noUser = await login({ username: "ghost", password: "123456" });

            expect(wrongPassword).toBeNull();
            expect(noUser).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // createGuest
    // ═════════════════════════════════════════════════════════════════════════

    describe("createGuest", () => {
        it("returns guest user with isGuest true", async () => {
            const result = await createGuest({ username: "Player1" });

            expect(result.user.isGuest).toBe(true);
            expect(result.user.username).toBe("Player1");
            expect(result.user.coins).toBe(0);
            expect(result.accessToken).toBe("access-token");
        });

        it("does not query DB (guests are stateless)", async () => {
            await createGuest({ username: "Player1" });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it("generates fallback username when empty after sanitize", async () => {
            const result = await createGuest({ username: "" });
            expect(result.user.username.length).toBeGreaterThan(0);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // refreshAccessToken
    // ═════════════════════════════════════════════════════════════════════════

    describe("refreshAccessToken", () => {
        it("returns null when token is invalid", async () => {
            mockVerify.mockResolvedValue(null);

            const result = await refreshAccessToken("bad-token");
            expect(result).toBeNull();
        });

        it("returns null for guest tokens", async () => {
            mockVerify.mockResolvedValue({
                sub: "g1",
                username: "Guest",
                isGuest: true,
                iat: 0,
                exp: 0,
            });

            const result = await refreshAccessToken("guest-refresh");
            expect(result).toBeNull();
        });

        it("returns null when user no longer exists", async () => {
            mockVerify.mockResolvedValue({
                sub: "u-deleted",
                username: "gone",
                isGuest: false,
                iat: 0,
                exp: 0,
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

            const result = await refreshAccessToken("valid-refresh");
            expect(result).toBeNull();
        });

        it("returns new access token for valid refresh", async () => {
            mockVerify.mockResolvedValue({
                sub: "u1",
                username: "alice",
                isGuest: false,
                iat: 0,
                exp: 0,
            });
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);

            const result = await refreshAccessToken("valid-refresh");

            expect(result).not.toBeNull();
            expect(result!.accessToken).toBe("access-token");
            expect(result!.user).toHaveProperty("id");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // logout
    // ═════════════════════════════════════════════════════════════════════════

    describe("logout", () => {
        it("invalidates access token", async () => {
            await logout("at", "u1");
            expect(mockInvalidate).toHaveBeenCalledWith("at");
        });

        it("revokes refresh token when provided", async () => {
            await logout("at", "u1", "rt");
            expect(mockRevoke).toHaveBeenCalledWith("u1", "rt");
        });

        it("does not revoke refresh when not provided", async () => {
            await logout("at", "u1");
            expect(mockRevoke).not.toHaveBeenCalled();
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // getUserById
    // ═════════════════════════════════════════════════════════════════════════

    describe("getUserById", () => {
        it("returns undefined when user not found", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
            expect(await getUserById("u-none")).toBeUndefined();
        });

        it("returns mapped User object", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);

            const user = await getUserById("u1");
            expect(user).toBeDefined();
            expect(user!.id).toBe("u1");
            expect(user!.username).toBe("alice");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // updateUser
    // ═════════════════════════════════════════════════════════════════════════

    describe("updateUser", () => {
        it("returns user from getUserById when no fields to update", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [userRow], rowCount: 1 } as any);

            const result = await updateUser("u1", {});
            expect(result).toBeDefined();
        });

        it("updates username via parameterized query", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ ...userRow, username: "newname" }], rowCount: 1 } as any);

            const result = await updateUser("u1", { username: "newname" });
            expect(result!.username).toBe("newname");
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE users SET"),
                expect.arrayContaining(["newname", "u1"]),
            );
        });

        it("returns undefined when user not found", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

            const result = await updateUser("u-gone", { bio: "test" });
            expect(result).toBeUndefined();
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // addCoinsToUser
    // ═════════════════════════════════════════════════════════════════════════

    describe("addCoinsToUser", () => {
        it("returns new balance on success", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ coins: 150 }], rowCount: 1 } as any);

            const balance = await addCoinsToUser("u1", 50);
            expect(balance).toBe(150);
        });

        it("returns null when user not found", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

            const balance = await addCoinsToUser("u-gone", 50);
            expect(balance).toBeNull();
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // getUserBalance
    // ═════════════════════════════════════════════════════════════════════════

    describe("getUserBalance", () => {
        it("returns coins for existing user", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ coins: 250 }], rowCount: 1 } as any);

            expect(await getUserBalance("u1")).toBe(250);
        });

        it("returns null when user not found", async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

            expect(await getUserBalance("u-gone")).toBeNull();
        });
    });
});
