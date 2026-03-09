import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

vi.mock("../../src/redis.ts", () => ({
    redis: {
        get: vi.fn(),
        del: vi.fn().mockResolvedValue(1),
        set: vi.fn().mockResolvedValue("OK"),
    },
}));

vi.mock("../../src/modules/auth/auth.service.ts", () => ({
    getUserById: vi.fn(),
    updateUser: vi.fn(),
    toPublicUser: vi.fn((u: any) => ({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        coins: u.coins,
    })),
}));

vi.mock("../../src/supabase.ts", () => ({
    supabase: {
        storage: {
            from: vi.fn().mockReturnValue({
                upload: vi.fn().mockResolvedValue({ error: null }),
                getPublicUrl: vi.fn().mockReturnValue({
                    data: { publicUrl: "https://cdn.test.com/avatar.png" },
                }),
            }),
        },
    },
}));

vi.mock("../../src/utils/env.ts", () => ({
    ENV: {
        SUPABASE_URL: "https://cdn.test.com",
    },
}));

import {
    handleGetMe,
    handleUpdateMe,
    handleUploadAvatar,
} from "../../src/modules/users/users.controller";
import { getUserById, updateUser, toPublicUser } from "../../src/modules/auth/auth.service";
import { redis } from "../../src/redis";
import type { Request, Response } from "express";

const mockGetUserById = vi.mocked(getUserById);
const mockUpdateUser = vi.mocked(updateUser);
const mockRedisGet = vi.mocked(redis.get);
const mockRedisDel = vi.mocked(redis.del);

// ─── Helpers ────────────────────────────────────────────────────────────────

const authCtx = { userId: "u1", username: "alice", isGuest: false };
const guestCtx = { userId: "g1", username: "Guest", isGuest: true };

const fullUser = {
    id: "u1",
    username: "alice",
    email: "a@b.com",
    passwordHash: "$hash$",
    avatarUrl: null,
    bio: "hi",
    coins: 100,
    isGuest: false as const,
    createdAt: "2025-01-01",
};

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        auth: authCtx,
        body: {},
        file: undefined,
        ...overrides,
    } as unknown as Request;
}

function makeRes(): Response & { _status: number; _json: unknown } {
    const res: any = {
        _status: 200,
        _json: null,
        status(code: number) {
            res._status = code;
            return res;
        },
        json(body: unknown) {
            res._json = body;
            return res;
        },
    };
    return res;
}

describe("users.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleGetMe
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleGetMe", () => {
        it("returns guest profile for guests", async () => {
            const req = makeReq({ auth: guestCtx } as any);
            const res = makeRes();

            await handleGetMe(req, res);

            expect(res._json).toMatchObject({ id: "g1", username: "Guest", coins: 0 });
        });

        it("returns cached session from Redis", async () => {
            const cached = JSON.stringify({ id: "u1", username: "alice", avatarUrl: null, bio: null, coins: 100 });
            mockRedisGet.mockResolvedValue(cached);

            const req = makeReq();
            const res = makeRes();

            await handleGetMe(req, res);

            expect(res._status).toBe(200);
            expect(res._json).toEqual(JSON.parse(cached));
            expect(mockGetUserById).not.toHaveBeenCalled();
        });

        it("falls back to DB when no cache", async () => {
            mockRedisGet.mockResolvedValue(null);
            mockGetUserById.mockResolvedValue(fullUser);

            const req = makeReq();
            const res = makeRes();

            await handleGetMe(req, res);

            expect(mockGetUserById).toHaveBeenCalledWith("u1");
        });

        it("returns 404 when user not in DB", async () => {
            mockRedisGet.mockResolvedValue(null);
            mockGetUserById.mockResolvedValue(undefined);

            const req = makeReq();
            const res = makeRes();

            await handleGetMe(req, res);

            expect(res._status).toBe(404);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleUpdateMe
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleUpdateMe", () => {
        it("returns 403 for guest users", async () => {
            const req = makeReq({ auth: guestCtx } as any);
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(403);
        });

        it("returns 400 when body is null", async () => {
            const req = makeReq({ body: null as any });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(400);
        });

        it("returns 422 when username is too short", async () => {
            const req = makeReq({ body: { username: "ab" } });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(422);
        });

        it("returns 422 when username exceeds 20 chars", async () => {
            const req = makeReq({ body: { username: "a".repeat(21) } });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(422);
        });

        it("returns 422 when bio exceeds 200 chars", async () => {
            const req = makeReq({ body: { bio: "x".repeat(201) } });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(422);
        });

        it("updates user and invalidates Redis cache", async () => {
            mockUpdateUser.mockResolvedValue(fullUser);

            const req = makeReq({ body: { bio: "new bio" } });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(mockUpdateUser).toHaveBeenCalled();
            expect(mockRedisDel).toHaveBeenCalledWith("session:u1");
        });

        it("returns 404 when updateUser returns undefined", async () => {
            mockUpdateUser.mockResolvedValue(undefined);

            const req = makeReq({ body: { bio: "hi" } });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(404);
        });

        // ── Security ────────────────────────────────────────────────────────

        it("rejects non-string username type", async () => {
            const req = makeReq({ body: { username: 12345 } });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(422);
        });

        it("rejects non-string bio type", async () => {
            const req = makeReq({ body: { bio: { injected: true } } });
            const res = makeRes();

            await handleUpdateMe(req, res);

            expect(res._status).toBe(422);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleUploadAvatar
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleUploadAvatar", () => {
        it("returns 403 for guests", async () => {
            const req = makeReq({ auth: guestCtx } as any);
            const res = makeRes();

            await handleUploadAvatar(req, res);

            expect(res._status).toBe(403);
        });

        it("returns 400 when no file", async () => {
            const req = makeReq({ file: undefined });
            const res = makeRes();

            await handleUploadAvatar(req, res);

            expect(res._status).toBe(400);
        });

        it("returns 422 for disallowed MIME type", async () => {
            const req = makeReq({
                file: {
                    mimetype: "application/pdf",
                    size: 1000,
                    buffer: Buffer.from(""),
                    originalname: "test.pdf",
                } as any,
            });
            const res = makeRes();

            await handleUploadAvatar(req, res);

            expect(res._status).toBe(422);
        });

        it("returns 422 when file exceeds 2 MB", async () => {
            const req = makeReq({
                file: {
                    mimetype: "image/png",
                    size: 3 * 1024 * 1024,
                    buffer: Buffer.from(""),
                    originalname: "big.png",
                } as any,
            });
            const res = makeRes();

            await handleUploadAvatar(req, res);

            expect(res._status).toBe(422);
        });

        it("uploads and updates avatar on valid file", async () => {
            mockUpdateUser.mockResolvedValue({ ...fullUser, avatarUrl: "https://cdn.test.com/avatar.png" });

            const req = makeReq({
                file: {
                    mimetype: "image/jpeg",
                    size: 50000,
                    buffer: Buffer.from("jpg-data"),
                    originalname: "photo.jpg",
                } as any,
            });
            const res = makeRes();

            await handleUploadAvatar(req, res);

            expect(mockUpdateUser).toHaveBeenCalled();
            expect(mockRedisDel).toHaveBeenCalledWith("session:u1");
        });

        // ── Security ────────────────────────────────────────────────────────

        it("rejects script disguised as image (wrong MIME)", async () => {
            const req = makeReq({
                file: {
                    mimetype: "text/html",
                    size: 100,
                    buffer: Buffer.from("<script>alert(1)</script>"),
                    originalname: "evil.html",
                } as any,
            });
            const res = makeRes();

            await handleUploadAvatar(req, res);

            expect(res._status).toBe(422);
        });

        it("only allows jpeg, png, webp, gif", async () => {
            const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
            const disallowed = ["image/svg+xml", "image/bmp", "application/octet-stream"];

            for (const mime of disallowed) {
                const req = makeReq({
                    file: {
                        mimetype: mime,
                        size: 100,
                        buffer: Buffer.from(""),
                        originalname: "test",
                    } as any,
                });
                const res = makeRes();
                await handleUploadAvatar(req, res);
                expect(res._status).toBe(422);
            }
        });
    });
});
