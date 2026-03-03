// ─── JWT Service ────────────────────────────────────────────────────────────
// Signs and verifies JWTs. Uses HMAC-SHA256 secret from ENV.
// Token blacklist and refresh tokens stored in PostgreSQL.

import { ENV } from "../../utils/env.ts";
import { query } from "../../db.ts";

// ─── Payload shape ──────────────────────────────────────────────────────────

export interface JwtPayload {
    sub: string;       // userId
    username: string;
    isGuest: boolean;
    iat: number;       // issued at  (epoch seconds)
    exp: number;       // expiry     (epoch seconds)
}

// ─── Helpers: base64url ─────────────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
    return Buffer.from(buf).toString("base64url");
}

function base64urlEncode(str: string): string {
    return Buffer.from(str).toString("base64url");
}

function base64urlDecode(b64: string): string {
    return Buffer.from(b64, "base64url").toString("utf8");
}

// ─── HMAC-SHA256 ────────────────────────────────────────────────────────────

async function hmac(data: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(ENV.JWT_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    return base64url(signature);
}

// ─── Sign ───────────────────────────────────────────────────────────────────

function parseExpiry(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7200; // fallback 2h
    const n = Number(match[1]);
    switch (match[2]) {
        case "s": return n;
        case "m": return n * 60;
        case "h": return n * 3600;
        case "d": return n * 86400;
        default: return 7200;
    }
}

export async function signToken(userId: string, username: string, isGuest: boolean): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const seconds = parseExpiry(ENV.JWT_EXPIRES_IN);
    const payload: JwtPayload = {
        sub: userId,
        username,
        isGuest,
        iat: now,
        exp: now + seconds,
    };

    const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = base64urlEncode(JSON.stringify(payload));
    const signature = await hmac(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
}

// ─── Verify ─────────────────────────────────────────────────────────────────

export async function verifyToken(token: string): Promise<JwtPayload | null> {
    // Check blacklist in DB
    const blacklisted = await query(
        `SELECT 1 FROM token_blacklist WHERE token = $1 AND expires_at > NOW() LIMIT 1`,
        [token],
    );
    if (blacklisted.rowCount && blacklisted.rowCount > 0) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts as [string, string, string];
    const expected = await hmac(`${header}.${body}`);
    if (sig !== expected) return null;

    try {
        const payload = JSON.parse(base64urlDecode(body)) as JwtPayload;
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

// ─── Invalidate ─────────────────────────────────────────────────────────────
// Store blacklisted tokens in DB with expiry for automatic cleanup.

export async function invalidateToken(token: string): Promise<void> {
    try {
        const parts = token.split(".");
        if (parts.length === 3) {
            const payload = JSON.parse(base64urlDecode(parts[1]!)) as JwtPayload;
            const expiresAt = new Date(payload.exp * 1000).toISOString();
            await query(
                `INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [token, expiresAt],
            );
        }
    } catch {
        // Best effort — insert with a 24h expiry
        const expiresAt = new Date(Date.now() + 86400_000).toISOString();
        await query(
            `INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [token, expiresAt],
        );
    }
}

// ─── Refresh token strategy ────────────────────────────────────────────────
// Stores refresh tokens in the `refresh_tokens` DB table.

export async function signRefreshToken(userId: string, username: string, isGuest: boolean): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const seconds = parseExpiry(ENV.REFRESH_EXPIRES_IN);
    const payload: JwtPayload = {
        sub: userId,
        username,
        isGuest,
        iat: now,
        exp: now + seconds,
    };

    const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT", kind: "refresh" }));
    const body = base64urlEncode(JSON.stringify(payload));
    const signature = await hmac(`${header}.${body}`);
    const token = `${header}.${body}.${signature}`;

    // Store in DB
    const expiresAt = new Date((now + seconds) * 1000).toISOString();
    await query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [userId, token, expiresAt],
    );

    return token;
}

export async function revokeRefreshToken(userId: string, token: string): Promise<void> {
    await query(
        `DELETE FROM refresh_tokens WHERE user_id = $1 AND token = $2`,
        [userId, token],
    );
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
    await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
}

/** Check if a refresh token exists and is valid in DB */
export async function isRefreshTokenValid(userId: string, token: string): Promise<boolean> {
    const result = await query(
        `SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW() LIMIT 1`,
        [userId, token],
    );
    return (result.rowCount ?? 0) > 0;
}
