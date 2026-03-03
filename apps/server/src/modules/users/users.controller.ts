// ─── Users Controller ────────────────────────────────────────────────────────
// GET  /users/me   → profile of authenticated user
// PATCH /users/me  → update avatar / bio

import type { Request, Response } from "express";
import type { UpdateProfileDTO } from "@izma/types";
import { getUserById, updateUser, toPublicUser } from "../auth/auth.service.ts";
import { isValidUrl, sanitize, type ValidationResult, fail, ok } from "../../utils/validation.ts";

// ─── Validation ─────────────────────────────────────────────────────────────

function validateProfileUpdate(dto: UpdateProfileDTO): ValidationResult {
    if (dto.avatarUrl !== undefined && dto.avatarUrl !== null) {
        if (typeof dto.avatarUrl !== "string") return fail("avatarUrl deve ser string.");
        if (dto.avatarUrl.length > 0 && !isValidUrl(dto.avatarUrl)) return fail("avatarUrl deve ser uma URL válida.");
    }
    if (dto.bio !== undefined && dto.bio !== null) {
        if (typeof dto.bio !== "string") return fail("bio deve ser string.");
        if (dto.bio.length > 200) return fail("bio deve ter no máximo 200 caracteres.");
    }
    return ok();
}

// ─── GET /users/me ──────────────────────────────────────────────────────────

export async function handleGetMe(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;

    if (ctx.isGuest) {
        res.json({
            id: ctx.userId,
            username: ctx.username,
            avatarUrl: null,
            bio: null,
            coins: 0,
        });
        return;
    }

    const user = await getUserById(ctx.userId);
    if (!user) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Usuário não encontrado." });
        return;
    }

    res.json(toPublicUser(user));
}

// ─── PATCH /users/me ────────────────────────────────────────────────────────

export async function handleUpdateMe(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;

    if (ctx.isGuest) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Visitantes não podem editar perfil." });
        return;
    }

    const body = req.body as UpdateProfileDTO;
    if (!body) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Body JSON inválido." });
        return;
    }

    const validation = validateProfileUpdate(body);
    if (!validation.ok) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: validation.message });
        return;
    }

    const patch: Partial<{ avatarUrl: string | null; bio: string | null }> = {};
    if (body.avatarUrl !== undefined) patch.avatarUrl = body.avatarUrl ?? null;
    if (body.bio !== undefined) patch.bio = body.bio ? sanitize(body.bio, 200) : null;

    const updated = await updateUser(ctx.userId, patch);
    if (!updated) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Usuário não encontrado." });
        return;
    }

    res.json(toPublicUser(updated));
}
