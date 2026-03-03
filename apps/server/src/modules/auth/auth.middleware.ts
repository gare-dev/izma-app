// ─── Auth Middleware ─────────────────────────────────────────────────────────
// Express middleware for JWT authentication.

import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "./jwt.service.ts";
import { ENV } from "../../utils/env.ts";

export interface AuthContext {
    userId: string;
    username: string;
    isGuest: boolean;
}

// Extend Express Request to include auth context
declare global {
    namespace Express {
        interface Request {
            auth?: AuthContext;
        }
    }
}

/** Extract the Bearer token from the Authorization header. */
function extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice(7);
}

/**
 * Requires a valid JWT. Returns 401 if missing/invalid.
 * Attaches `req.auth` with the decoded context.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = extractToken(req);
    if (!token) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized", message: "Token de autenticação ausente." });
        return;
    }

    const payload = await verifyToken(token);
    if (!payload) {
        res.status(401).json({ statusCode: 401, error: "Unauthorized", message: "Token inválido ou expirado." });
        return;
    }

    req.auth = {
        userId: payload.sub,
        username: payload.username,
        isGuest: payload.isGuest,
    };

    next();
}

/**
 * Accepts valid JWT or no JWT (guest).
 * Always attaches req.auth — guests get isGuest = true.
 */
export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = extractToken(req);
    if (!token) {
        req.auth = { userId: "", username: "Guest", isGuest: true };
        next();
        return;
    }

    const payload = await verifyToken(token);
    if (!payload) {
        req.auth = { userId: "", username: "Guest", isGuest: true };
        next();
        return;
    }

    req.auth = {
        userId: payload.sub,
        username: payload.username,
        isGuest: payload.isGuest,
    };

    next();
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────
// Simple in-memory sliding-window per IP. For production use Redis.

const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitAuth(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? "unknown";
    const now = Date.now();
    const entry = attempts.get(ip);

    if (!entry || now > entry.resetAt) {
        attempts.set(ip, { count: 1, resetAt: now + 60_000 });
        next();
        return;
    }

    entry.count++;
    if (entry.count > ENV.RATE_LIMIT_AUTH_PER_MINUTE) {
        res.status(429).json({ statusCode: 429, error: "Too Many Requests", message: "Muitas tentativas. Aguarde 1 minuto." });
        return;
    }

    next();
}
