import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

vi.mock("../../src/redis.ts", () => ({
    redis: {
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        get: vi.fn(),
    },
}));

vi.mock("../../src/modules/auth/auth.service.ts", () => ({
    validateRegister: vi.fn(),
    validateLogin: vi.fn(),
    validateGuest: vi.fn(),
    register: vi.fn(),
    login: vi.fn(),
    createGuest: vi.fn(),
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
}));

vi.mock("../../src/modules/auth/jwt.service.ts", () => ({
    verifyToken: vi.fn(),
}));

import {
    handleRegister,
    handleLogin,
    handleGuest,
    handleRefresh,
    handleLogout,
} from "../../src/modules/auth/auth.controller";
import {
    validateRegister,
    validateLogin,
    validateGuest,
    register,
    login,
    createGuest,
    refreshAccessToken,
    logout,
} from "../../src/modules/auth/auth.service";
import { verifyToken } from "../../src/modules/auth/jwt.service";
import { redis } from "../../src/redis";
import type { Request, Response } from "express";

const mockValidateRegister = vi.mocked(validateRegister);
const mockValidateLogin = vi.mocked(validateLogin);
const mockValidateGuest = vi.mocked(validateGuest);
const mockRegister = vi.mocked(register);
const mockLogin = vi.mocked(login);
const mockCreateGuest = vi.mocked(createGuest);
const mockRefresh = vi.mocked(refreshAccessToken);
const mockLogout = vi.mocked(logout);
const mockVerify = vi.mocked(verifyToken);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        body: null,
        cookies: {},
        ...overrides,
    } as unknown as Request;
}

function makeRes(): Response & { _status: number; _json: unknown; _cookies: Record<string, any> } {
    const res: any = {
        _status: 200,
        _json: null,
        _cookies: {},
        status(code: number) {
            res._status = code;
            return res;
        },
        json(body: unknown) {
            res._json = body;
            return res;
        },
        cookie(name: string, value: string, opts?: any) {
            res._cookies[name] = { value, ...opts };
            return res;
        },
    };
    return res;
}

const publicUser = { id: "u1", username: "alice", avatarUrl: null, bio: null, coins: 0 };

describe("auth.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleRegister
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleRegister", () => {
        it("returns 400 when body is null", async () => {
            const req = makeReq({ body: null as any });
            const res = makeRes();

            await handleRegister(req, res);

            expect(res._status).toBe(400);
        });

        it("returns 422 on validation failure", async () => {
            mockValidateRegister.mockResolvedValue({ ok: false, message: "Username too short" });

            const req = makeReq({ body: { username: "a", email: "a@b.com", password: "123456" } });
            const res = makeRes();

            await handleRegister(req, res);

            expect(res._status).toBe(422);
        });

        it("returns 201 with user and sets cookies on success", async () => {
            mockValidateRegister.mockResolvedValue({ ok: true });
            mockRegister.mockResolvedValue({
                user: publicUser,
                accessToken: "at",
                refreshToken: "rt",
            });

            const req = makeReq({ body: { username: "alice", email: "a@b.com", password: "123456" } });
            const res = makeRes();

            await handleRegister(req, res);

            expect(res._status).toBe(201);
            expect(res._json).toEqual({ user: publicUser });
            expect(res._cookies.accessToken).toBeDefined();
            expect(res._cookies.accessToken.value).toBe("at");
            expect(res._cookies.refreshToken).toBeDefined();
        });

        // ── Security ────────────────────────────────────────────────────────

        it("sets httpOnly on auth cookies", async () => {
            mockValidateRegister.mockResolvedValue({ ok: true });
            mockRegister.mockResolvedValue({
                user: publicUser,
                accessToken: "at",
                refreshToken: "rt",
            });

            const req = makeReq({ body: { username: "alice", email: "a@b.com", password: "123456" } });
            const res = makeRes();

            await handleRegister(req, res);

            expect(res._cookies.accessToken.httpOnly).toBe(true);
            expect(res._cookies.refreshToken.httpOnly).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleLogin
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleLogin", () => {
        it("returns 400 when body is null", async () => {
            const req = makeReq({ body: null as any });
            const res = makeRes();

            await handleLogin(req, res);
            expect(res._status).toBe(400);
        });

        it("returns 422 on validation failure", async () => {
            mockValidateLogin.mockReturnValue({ ok: false, message: "Missing field" });

            const req = makeReq({ body: { username: "", password: "" } });
            const res = makeRes();

            await handleLogin(req, res);
            expect(res._status).toBe(422);
        });

        it("returns 401 when credentials invalid", async () => {
            mockValidateLogin.mockReturnValue({ ok: true });
            mockLogin.mockResolvedValue(null);

            const req = makeReq({ body: { username: "alice", password: "wrong" } });
            const res = makeRes();

            await handleLogin(req, res);
            expect(res._status).toBe(401);
        });

        it("returns 200 with user on successful login", async () => {
            mockValidateLogin.mockReturnValue({ ok: true });
            mockLogin.mockResolvedValue({
                user: publicUser,
                accessToken: "at",
                refreshToken: "rt",
            });

            const req = makeReq({ body: { username: "alice", password: "123456" } });
            const res = makeRes();

            await handleLogin(req, res);

            expect(res._status).toBe(200);
            expect(res._json).toEqual({ user: publicUser });
        });

        it("caches session in Redis after login", async () => {
            mockValidateLogin.mockReturnValue({ ok: true });
            mockLogin.mockResolvedValue({
                user: publicUser,
                accessToken: "at",
                refreshToken: "rt",
            });

            const req = makeReq({ body: { username: "alice", password: "123456" } });
            const res = makeRes();

            await handleLogin(req, res);

            expect(redis.set).toHaveBeenCalledWith(
                `session:${publicUser.id}`,
                expect.any(String),
                "EX",
                7200,
            );
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleGuest
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleGuest", () => {
        it("returns 400 when body is null", async () => {
            const req = makeReq({ body: null as any });
            const res = makeRes();

            await handleGuest(req, res);
            expect(res._status).toBe(400);
        });

        it("returns 422 on validation failure", async () => {
            mockValidateGuest.mockReturnValue({ ok: false, message: "Missing" });

            const req = makeReq({ body: { username: "" } });
            const res = makeRes();

            await handleGuest(req, res);
            expect(res._status).toBe(422);
        });

        it("returns 201 with guest user", async () => {
            mockValidateGuest.mockReturnValue({ ok: true });
            const guestUser = { id: "g1", username: "Player1", avatarUrl: null, bio: null, coins: 0, isGuest: true as const };
            mockCreateGuest.mockResolvedValue({ user: guestUser, accessToken: "at" });

            const req = makeReq({ body: { username: "Player1" } });
            const res = makeRes();

            await handleGuest(req, res);

            expect(res._status).toBe(201);
            expect(res._json).toEqual({ user: guestUser });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleRefresh
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleRefresh", () => {
        it("returns 401 when no refresh cookie", async () => {
            const req = makeReq({ cookies: {} });
            const res = makeRes();

            await handleRefresh(req, res);
            expect(res._status).toBe(401);
        });

        it("returns 401 when refresh token is invalid", async () => {
            mockRefresh.mockResolvedValue(null);

            const req = makeReq({ cookies: { refreshToken: "bad" } });
            const res = makeRes();

            await handleRefresh(req, res);
            expect(res._status).toBe(401);
        });

        it("returns 200 with new access token", async () => {
            mockRefresh.mockResolvedValue({ user: publicUser, accessToken: "new-at" });

            const req = makeReq({ cookies: { refreshToken: "valid-rt" } });
            const res = makeRes();

            await handleRefresh(req, res);

            expect(res._status).toBe(200);
            expect(res._cookies.accessToken.value).toBe("new-at");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleLogout
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleLogout", () => {
        it("clears cookies even without access token", async () => {
            const req = makeReq({ cookies: {} });
            const res = makeRes();

            await handleLogout(req, res);

            expect(res._status).toBe(200);
            expect(res._cookies.accessToken.maxAge).toBe(0);
            expect(res._cookies.refreshToken.maxAge).toBe(0);
        });

        it("invalidates tokens when access token is valid", async () => {
            mockVerify.mockResolvedValue({
                sub: "u1",
                username: "alice",
                isGuest: false,
                iat: 0,
                exp: 0,
            });
            mockLogout.mockResolvedValue(undefined);

            const req = makeReq({ cookies: { accessToken: "at", refreshToken: "rt" } });
            const res = makeRes();

            await handleLogout(req, res);

            expect(mockLogout).toHaveBeenCalledWith("at", "u1", "rt");
            expect(res._status).toBe(200);
        });

        it("does not call logout when access token is expired/invalid", async () => {
            mockVerify.mockResolvedValue(null);

            const req = makeReq({ cookies: { accessToken: "expired" } });
            const res = makeRes();

            await handleLogout(req, res);

            expect(mockLogout).not.toHaveBeenCalled();
            expect(res._status).toBe(200);
        });
    });
});
