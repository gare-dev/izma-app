// ─── Users Controller ────────────────────────────────────────────────────────
// GET  /users/me         → profile of authenticated user
// PATCH /users/me        → update username / bio
// POST /users/me/avatar  → upload avatar image (Supabase bucket)

import type { Request, Response } from "express";
import type { UpdateProfileDTO } from "@izma/types";
import { getUserById, updateUser, toPublicUser } from "../auth/auth.service.ts";
import { sanitize, type ValidationResult, fail, ok } from "../../utils/validation.ts";
import { redis } from "../../redis.ts";
import { supabase } from "../../supabase.ts";
import { ENV } from "../../utils/env.ts";

// ─── Constants ──────────────────────────────────────────────────────────────

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ─── Validation ─────────────────────────────────────────────────────────────

function validateProfileUpdate(dto: UpdateProfileDTO): ValidationResult {
    if (dto.username !== undefined && dto.username !== null) {
        if (typeof dto.username !== "string") return fail("username deve ser string.");
        const trimmed = dto.username.trim();
        if (trimmed.length < 3) return fail("Username deve ter no mínimo 3 caracteres.");
        if (trimmed.length > 20) return fail("Username deve ter no máximo 20 caracteres.");
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

    const cached = await redis.get(`session:${ctx.userId}`);

    if (cached) {
        res.status(200).json(JSON.parse(cached));
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

    const patch: Partial<{ avatarUrl: string | null; bio: string | null; username: string }> = {};
    if (body.avatarUrl !== undefined) patch.avatarUrl = body.avatarUrl ?? null;
    if (body.bio !== undefined) patch.bio = body.bio ? sanitize(body.bio, 200) : null;
    if (body.username !== undefined) patch.username = body.username.trim();

    const updated = await updateUser(ctx.userId, patch);
    if (!updated) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Usuário não encontrado." });
        return;
    }

    // Invalidate cached session
    await redis.del(`session:${ctx.userId}`);

    res.json(toPublicUser(updated));
}

// ─── POST /users/me/avatar ──────────────────────────────────────────────────

export async function handleUploadAvatar(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;

    if (ctx.isGuest) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Visitantes não podem enviar avatar." });
        return;
    }

    const file = req.file;
    if (!file) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Nenhum arquivo enviado." });
        return;
    }

    if (!ALLOWED_MIME.includes(file.mimetype)) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: "Formato de imagem inválido. Use JPEG, PNG, WebP ou GIF." });
        return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: "Imagem muito grande. Máximo 2 MB." });
        return;
    }

    const ext = file.mimetype.split("/")[1] ?? "png";
    const filePath = `${ctx.userId}.${ext}`;

    // Upload to Supabase Storage (upsert replaces existing)
    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });

    if (uploadError) {
        console.error("[avatar] upload error:", uploadError.message);
        res.status(500).json({ statusCode: 500, error: "Internal Server Error", message: "Falha ao enviar avatar." });
        return;
    }

    // Build the public URL
    const { data: urlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

    const avatarUrl = urlData.publicUrl;

    // Persist in DB
    const updated = await updateUser(ctx.userId, { avatarUrl });
    if (!updated) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Usuário não encontrado." });
        return;
    }

    // Invalidate cached session
    await redis.del(`session:${ctx.userId}`);

    res.json(toPublicUser(updated));
}

