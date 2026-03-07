// ─── Auth Service ───────────────────────────────────────────────────────────
// Business logic for register, login, guest, and token refresh.
// Uses PostgreSQL via `pg` Pool for all user data.

import { v4 as uuid } from "uuid";
import type { User, GuestUser, PublicUser, RegisterDTO, LoginDTO, GuestDTO } from "@izma/types";
import { hashPassword, comparePassword } from "./password.service.ts";
import { signToken, signRefreshToken, verifyToken, invalidateToken, revokeRefreshToken } from "./jwt.service.ts";
import { isValidEmail, isNonEmptyString, sanitize, type ValidationResult, fail, ok } from "../../utils/validation.ts";
import { query } from "../../db.ts";

// ─── Validation ─────────────────────────────────────────────────────────────

export async function validateRegister(dto: RegisterDTO): Promise<ValidationResult> {
    if (!isNonEmptyString(dto.username)) return fail("Username é obrigatório.");
    if (dto.username.trim().length < 3) return fail("Username deve ter no mínimo 3 caracteres.");
    if (dto.username.trim().length > 20) return fail("Username deve ter no máximo 20 caracteres.");
    if (!isValidEmail(dto.email)) return fail("E-mail inválido.");
    if (!isNonEmptyString(dto.password)) return fail("Senha é obrigatória.");
    if (dto.password.length < 6) return fail("Senha deve ter no mínimo 6 caracteres.");

    // Check uniqueness in DB
    const existingUsername = await query(
        `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [dto.username.trim()],
    );
    if ((existingUsername.rowCount ?? 0) > 0) return fail("Username já está em uso.");

    const existingEmail = await query(
        `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [dto.email.trim()],
    );
    if ((existingEmail.rowCount ?? 0) > 0) return fail("E-mail já cadastrado.");

    return ok();
}

export function validateLogin(dto: LoginDTO): ValidationResult {
    if (!isNonEmptyString(dto.username)) return fail("Username é obrigatório.");
    if (!isNonEmptyString(dto.password)) return fail("Senha é obrigatória.");
    return ok();
}

export function validateGuest(dto: GuestDTO): ValidationResult {
    if (!isNonEmptyString(dto.username)) return fail("Apelido é obrigatório.");
    if (dto.username.trim().length > 20) return fail("Apelido deve ter no máximo 20 caracteres.");
    return ok();
}

// ─── Service functions ──────────────────────────────────────────────────────

export async function register(dto: RegisterDTO): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
    const id = uuid();
    const username = sanitize(dto.username.trim(), 20);
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await hashPassword(dto.password);

    const result = await query(
        `INSERT INTO users (id, username, email, password_hash, is_guest)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id, username, email, avatar_url, bio, coins, is_guest, created_at`,
        [id, username, email, passwordHash],
    );

    const row = result.rows[0];
    const user = rowToUser(row);

    const accessToken = await signToken(id, username, false);
    const refreshToken = await signRefreshToken(id, username, false);

    return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function login(dto: LoginDTO): Promise<{ user: PublicUser; accessToken: string; refreshToken: string } | null> {
    const result = await query(
        `SELECT id, username, email, password_hash, avatar_url, bio, coins, is_guest, created_at
         FROM users
         WHERE LOWER(username) = LOWER($1) AND is_guest = false
         LIMIT 1`,
        [dto.username.trim()],
    );

    if ((result.rowCount ?? 0) === 0) return null;

    const row = result.rows[0];
    const valid = await comparePassword(dto.password, row.password_hash);
    if (!valid) return null;

    const user = rowToUser(row);
    const accessToken = await signToken(user.id, user.username, false);
    const refreshToken = await signRefreshToken(user.id, user.username, false);

    return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function createGuest(dto: GuestDTO): Promise<{ user: GuestUser; accessToken: string }> {
    const id = uuid();
    const username = sanitize(dto.username.trim(), 20) || `Guest${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const guest: GuestUser = {
        id,
        username,
        avatarUrl: null,
        bio: null,
        coins: 0,
        isGuest: true,
    };

    const accessToken = await signToken(id, username, true);

    return { user: guest, accessToken };
}

export async function refreshAccessToken(refreshTokenStr: string): Promise<{ user: PublicUser; accessToken: string } | null> {
    const payload = await verifyToken(refreshTokenStr);
    if (!payload) return null;
    if (payload.isGuest) return null; // guests don't get refresh

    const user = await getUserById(payload.sub);
    if (!user) return null;

    const accessToken = await signToken(user.id, user.username, false);

    return { user: toPublicUser(user), accessToken };
}

export async function logout(accessToken: string, userId: string, refreshTokenStr?: string): Promise<void> {
    await invalidateToken(accessToken);
    if (refreshTokenStr) {
        await revokeRefreshToken(userId, refreshTokenStr);
    }
}

// ─── Lookup helpers (used by other modules) ─────────────────────────────────

export async function getUserById(id: string): Promise<User | undefined> {
    const result = await query(
        `SELECT id, username, email, password_hash, avatar_url, bio, coins, is_guest, created_at
         FROM users WHERE id = $1 LIMIT 1`,
        [id],
    );
    if ((result.rowCount ?? 0) === 0) return undefined;
    return rowToUser(result.rows[0]);
}

export async function updateUser(
    id: string,
    patch: Partial<Pick<User, "avatarUrl" | "bio" | "username">>,
): Promise<User | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (patch.avatarUrl !== undefined) {
        fields.push(`avatar_url = $${idx++}`);
        values.push(patch.avatarUrl);
    }
    if (patch.bio !== undefined) {
        fields.push(`bio = $${idx++}`);
        values.push(patch.bio);
    }
    if (patch.username !== undefined) {
        fields.push(`username = $${idx++}`);
        values.push(patch.username);
    }

    if (fields.length === 0) return getUserById(id);

    values.push(id);
    const result = await query(
        `UPDATE users SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${idx}
         RETURNING id, username, email, password_hash, avatar_url, bio, coins, is_guest, created_at`,
        values,
    );

    if ((result.rowCount ?? 0) === 0) return undefined;
    return rowToUser(result.rows[0]);
}

export async function addCoinsToUser(userId: string, amount: number): Promise<number | null> {
    const result = await query(
        `UPDATE users SET coins = coins + $1, updated_at = NOW()
         WHERE id = $2
         RETURNING coins`,
        [amount, userId],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return result.rows[0].coins;
}

export async function getUserBalance(userId: string): Promise<number | null> {
    const result = await query(
        `SELECT coins FROM users WHERE id = $1 LIMIT 1`,
        [userId],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return result.rows[0].coins;
}

// ─── Row mapping ────────────────────────────────────────────────────────────

function rowToUser(row: any): User {
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        passwordHash: row.password_hash,
        avatarUrl: row.avatar_url,
        bio: row.bio,
        coins: row.coins,
        isGuest: row.is_guest,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
}

// ─── Serialisation ──────────────────────────────────────────────────────────

export function toPublicUser(user: User): PublicUser {
    return {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        coins: user.coins,
    };
}
