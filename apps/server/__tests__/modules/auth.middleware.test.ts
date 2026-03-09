import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../src/modules/auth/jwt.service.ts", () => ({
    verifyToken: vi.fn(),
}));

vi.mock("../../src/utils/env.ts", () => ({
    ENV: {
        RATE_LIMIT_AUTH_PER_MINUTE: 3,
    },
}));

import { authMiddleware, optionalAuthMiddleware, rateLimitAuth } from "../../src/modules/auth/auth.middleware";
import { verifyToken } from "../../src/modules/auth/jwt.service";
import type { Request, Response, NextFunction } from "express";

const mockVerify = vi.mocked(verifyToken);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        cookies: {},
        headers: {},
        ip: "127.0.0.1",
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

describe("auth.middleware", () => {
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        next = vi.fn();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // extractToken (tested implicitly via authMiddleware)
    // ═════════════════════════════════════════════════════════════════════════

    describe("authMiddleware", () => {
        it("returns 401 when no token present", async () => {
            const req = makeReq();
            const res = makeRes();

            await authMiddleware(req, res, next);

            expect(res._status).toBe(401);
            expect(res._json).toMatchObject({ statusCode: 401 });
            expect(next).not.toHaveBeenCalled();
        });

        it("returns 401 when token is invalid", async () => {
            const req = makeReq({ cookies: { accessToken: "bad-token" } });
            const res = makeRes();
            mockVerify.mockResolvedValue(null);

            await authMiddleware(req, res, next);

            expect(res._status).toBe(401);
            expect(next).not.toHaveBeenCalled();
        });

        it("sets req.auth and calls next on valid cookie token", async () => {
            const req = makeReq({ cookies: { accessToken: "good-token" } });
            const res = makeRes();
            mockVerify.mockResolvedValue({
                sub: "u1",
                username: "alice",
                isGuest: false,
                iat: 0,
                exp: 0,
            });

            await authMiddleware(req, res, next);

            expect(req.auth).toEqual({ userId: "u1", username: "alice", isGuest: false });
            expect(next).toHaveBeenCalled();
        });

        it("extracts token from Authorization header when no cookie", async () => {
            const req = makeReq({
                cookies: {},
                headers: { authorization: "Bearer header-token" },
            });
            const res = makeRes();
            mockVerify.mockResolvedValue({
                sub: "u2",
                username: "bob",
                isGuest: true,
                iat: 0,
                exp: 0,
            });

            await authMiddleware(req, res, next);

            expect(mockVerify).toHaveBeenCalledWith("header-token");
            expect(req.auth).toEqual({ userId: "u2", username: "bob", isGuest: true });
            expect(next).toHaveBeenCalled();
        });

        it("ignores non-Bearer authorization header", async () => {
            const req = makeReq({
                cookies: {},
                headers: { authorization: "Basic abc123" },
            });
            const res = makeRes();

            await authMiddleware(req, res, next);

            expect(res._status).toBe(401);
            expect(next).not.toHaveBeenCalled();
        });

        // ── Security tests ──────────────────────────────────────────────────

        it("rejects empty string token in cookie", async () => {
            const req = makeReq({ cookies: { accessToken: "" } });
            const res = makeRes();

            await authMiddleware(req, res, next);

            expect(res._status).toBe(401);
            expect(next).not.toHaveBeenCalled();
        });

        it("prefers cookie over header when both present", async () => {
            const req = makeReq({
                cookies: { accessToken: "cookie-token" },
                headers: { authorization: "Bearer header-token" },
            });
            const res = makeRes();
            mockVerify.mockResolvedValue({
                sub: "u1",
                username: "alice",
                isGuest: false,
                iat: 0,
                exp: 0,
            });

            await authMiddleware(req, res, next);

            expect(mockVerify).toHaveBeenCalledWith("cookie-token");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // optionalAuthMiddleware
    // ═════════════════════════════════════════════════════════════════════════

    describe("optionalAuthMiddleware", () => {
        it("sets guest auth and calls next when no token", async () => {
            const req = makeReq();
            const res = makeRes();

            await optionalAuthMiddleware(req, res, next);

            expect(req.auth).toEqual({ userId: "", username: "Guest", isGuest: true });
            expect(next).toHaveBeenCalled();
        });

        it("sets guest auth when token is invalid", async () => {
            const req = makeReq({ cookies: { accessToken: "bad" } });
            const res = makeRes();
            mockVerify.mockResolvedValue(null);

            await optionalAuthMiddleware(req, res, next);

            expect(req.auth).toEqual({ userId: "", username: "Guest", isGuest: true });
            expect(next).toHaveBeenCalled();
        });

        it("sets real auth when token is valid", async () => {
            const req = makeReq({ cookies: { accessToken: "good" } });
            const res = makeRes();
            mockVerify.mockResolvedValue({
                sub: "u3",
                username: "carol",
                isGuest: false,
                iat: 0,
                exp: 0,
            });

            await optionalAuthMiddleware(req, res, next);

            expect(req.auth).toEqual({ userId: "u3", username: "carol", isGuest: false });
            expect(next).toHaveBeenCalled();
        });

        it("never returns a 401 status", async () => {
            const req = makeReq();
            const res = makeRes();
            mockVerify.mockResolvedValue(null);

            await optionalAuthMiddleware(req, res, next);

            expect(res._status).toBe(200);
            expect(next).toHaveBeenCalled();
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // rateLimitAuth
    // ═════════════════════════════════════════════════════════════════════════

    describe("rateLimitAuth", () => {
        it("allows requests under the limit", () => {
            const req = makeReq({ ip: "10.0.0.1" });
            const res = makeRes();

            rateLimitAuth(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it("returns 429 when rate limit exceeded", () => {
            const ip = "10.0.0.99";

            // Exhaust limit (ENV.RATE_LIMIT_AUTH_PER_MINUTE = 3)
            for (let i = 0; i < 3; i++) {
                const req = makeReq({ ip });
                const res = makeRes();
                rateLimitAuth(req, res, vi.fn());
            }

            const req = makeReq({ ip });
            const res = makeRes();
            const n = vi.fn();
            rateLimitAuth(req, res, n);

            expect(res._status).toBe(429);
            expect(res._json).toMatchObject({ statusCode: 429 });
            expect(n).not.toHaveBeenCalled();
        });

        it("uses x-forwarded-for when ip is undefined", () => {
            const req = makeReq({
                ip: undefined as any,
                headers: { "x-forwarded-for": "192.168.1.1" },
            });
            const res = makeRes();

            rateLimitAuth(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it("different IPs have independent limits", () => {
            // Exhaust limit for IP A
            for (let i = 0; i < 4; i++) {
                const req = makeReq({ ip: "10.0.1.1" });
                const res = makeRes();
                rateLimitAuth(req, res, vi.fn());
            }

            // IP B should still be allowed
            const req = makeReq({ ip: "10.0.1.2" });
            const res = makeRes();
            rateLimitAuth(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });
});
