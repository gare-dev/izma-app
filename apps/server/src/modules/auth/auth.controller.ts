// ─── Auth Controller ────────────────────────────────────────────────────────
// Express request handlers for auth endpoints.

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

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        path: "/auth/refresh",
        maxAge: 604800_000, // 7 days in ms
    });

    res.status(201).json(result.auth);
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

    res.status(200).cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        path: "/auth/refresh",
        maxAge: 604800_000,
    }).json(result.auth);

    // Cache session in Redis (TTL = 2h = 7200s)
    await redis.set(
        `session:${result.auth.user.id}`,
        JSON.stringify({
            id: result.auth.user.id,
            username: result.auth.user.username,
            avatarUrl: result.auth.user.avatarUrl,
            bio: result.auth.user.bio,
            coins: result.auth.user.coins,
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
    res.status(201).json(result.auth);
}

// ─── POST /auth/refresh ─────────────────────────────────────────────────────

export async function handleRefresh(req: Request, res: Response): Promise<void> {
    // Read from cookie (cookie-parser populates req.cookies)
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

    res.status(200).json(result);
}

// ─── POST /auth/logout ──────────────────────────────────────────────────────

export async function handleLogout(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const refreshToken = req.cookies?.refreshToken;

    if (accessToken) {
        const { verifyToken } = await import("./jwt.service.ts");
        const payload = await verifyToken(accessToken);
        if (payload) {
            await logout(accessToken, payload.sub, refreshToken);
        }
    }

    // Clear refresh token cookie
    res.cookie("refreshToken", "", {
        httpOnly: true,
        sameSite: "strict",
        path: "/auth/refresh",
        maxAge: 0,
    });

    res.status(200).json({ ok: true });
}
