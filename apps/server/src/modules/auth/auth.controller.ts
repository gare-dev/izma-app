// ─── Auth Controller ────────────────────────────────────────────────────────
// Express request handlers for auth endpoints.
// All tokens (access + refresh) are set as HttpOnly cookies — never in the response body.

import type { Request, Response } from "express";
import type { RegisterDTO, LoginDTO, GuestDTO } from "@izma/types";
import { redis } from "../../redis.ts";
import {
    validateRegister,
    validateLogin,
    validateGuest,
    register,
    login,
    createGuest,
    refreshAccessToken,
    logout,
} from "./auth.service.ts";

// ─── Cookie helpers ─────────────────────────────────────────────────────────

const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
};

function setAuthCookies(res: Response, accessToken: string, refreshToken?: string) {
    res.cookie("accessToken", accessToken, {
        ...COOKIE_OPTS,
        maxAge: 7_200_000, // 2 h (matches JWT expiry)
    });
    if (refreshToken) {
        res.cookie("refreshToken", refreshToken, {
            ...COOKIE_OPTS,
            maxAge: 604_800_000, // 7 days
        });
    }
}

function clearAuthCookies(res: Response) {
    res.cookie("accessToken", "", { ...COOKIE_OPTS, maxAge: 0 });
    res.cookie("refreshToken", "", { ...COOKIE_OPTS, maxAge: 0 });
}

// ─── POST /auth/register ────────────────────────────────────────────────────

export async function handleRegister(req: Request, res: Response): Promise<void> {
    const body = req.body as RegisterDTO;
    if (!body) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Body JSON inválido." });
        return;
    }

    const validation = await validateRegister(body);
    if (!validation.ok) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: validation.message });
        return;
    }

    const result = await register(body);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ user: result.user });
}

// ─── POST /auth/login ───────────────────────────────────────────────────────

export async function handleLogin(req: Request, res: Response): Promise<void> {
    const body = req.body as LoginDTO;
    if (!body) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Body JSON inválido." });
        return;
    }

    const validation = validateLogin(body);
    if (!validation.ok) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: validation.message });
        return;
    }

    const result = await login(body);
    if (!result) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized", message: "Credenciais inválidas." });
        return;
    }

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({ user: result.user });

    // Cache session in Redis (TTL = 2h = 7200s)
    await redis.set(
        `session:${result.user.id}`,
        JSON.stringify({
            id: result.user.id,
            username: result.user.username,
            avatarUrl: result.user.avatarUrl,
            bio: result.user.bio,
            coins: result.user.coins,
        }),
        "EX",
        7200,
    );
}

// ─── POST /auth/guest ───────────────────────────────────────────────────────

export async function handleGuest(req: Request, res: Response): Promise<void> {
    const body = req.body as GuestDTO;
    if (!body) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Body JSON inválido." });
        return;
    }

    const validation = validateGuest(body);
    if (!validation.ok) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: validation.message });
        return;
    }

    const result = await createGuest(body);
    setAuthCookies(res, result.accessToken);
    res.status(201).json({ user: result.user });
}

// ─── POST /auth/refresh ─────────────────────────────────────────────────────

export async function handleRefresh(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized", message: "Refresh token ausente." });
        return;
    }

    const result = await refreshAccessToken(refreshToken);
    if (!result) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized", message: "Refresh token inválido ou expirado." });
        return;
    }

    setAuthCookies(res, result.accessToken);
    res.status(200).json({ user: result.user });
}

// ─── POST /auth/logout ──────────────────────────────────────────────────────

export async function handleLogout(req: Request, res: Response): Promise<void> {
    const accessToken = req.cookies?.accessToken ?? null;
    const refreshToken = req.cookies?.refreshToken;

    if (accessToken) {
        const { verifyToken } = await import("./jwt.service.ts");
        const payload = await verifyToken(accessToken);
        if (payload) {
            await logout(accessToken, payload.sub, refreshToken);
        }
    }

    clearAuthCookies(res);
    res.status(200).json({ ok: true });
}
