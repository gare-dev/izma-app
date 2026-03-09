// ─── Clan Controller ────────────────────────────────────────────────────────

import type { Request, Response } from "express";
import type { CreateClanDTO, UpdateClanDTO } from "@izma/types";
import {
    createClan,
    getClanDetail,
    getClanById,
    listClans,
    getUserClan,
    joinClan,
    joinClanByInvite,
    acceptMember,
    rejectMember,
    leaveClan,
    kickMember,
    updateClan,
    updateClanAvatar,
    deleteClan,
    regenerateInvite,
    getClanMessages,
    isClanMember,
} from "./clan.service.ts";
import { supabase } from "../../supabase.ts";
import { ENV } from "../../utils/env.ts";

const AVATAR_BUCKET = "clan-avatars";
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ─── POST /clans ────────────────────────────────────────────────────────────

export async function handleCreateClan(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    if (ctx.isGuest) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Visitantes não podem criar clãs." });
        return;
    }

    const body = req.body as CreateClanDTO;
    if (!body?.name || typeof body.name !== "string") {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Nome do clã é obrigatório." });
        return;
    }

    const result = await createClan(ctx.userId, body);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }

    res.status(201).json(result.clan);
}

// ─── GET /clans ─────────────────────────────────────────────────────────────

export async function handleListClans(req: Request, res: Response): Promise<void> {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const clans = await listClans(search);
    res.json(clans);
}

// ─── GET /clans/me ──────────────────────────────────────────────────────────

export async function handleGetMyClan(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    if (ctx.isGuest) {
        res.json(null);
        return;
    }

    const clan = await getUserClan(ctx.userId);
    if (!clan) {
        res.json(null);
        return;
    }

    const detail = await getClanDetail(clan.id);
    res.json(detail);
}

// ─── GET /clans/:id ─────────────────────────────────────────────────────────

export async function handleGetClan(req: Request, res: Response): Promise<void> {
    const clan = await getClanDetail(req.params.id as string);
    if (!clan) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Clã não encontrado." });
        return;
    }
    res.json(clan);
}

// ─── PATCH /clans/:id ───────────────────────────────────────────────────────

export async function handleUpdateClan(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const body = req.body as UpdateClanDTO;

    const result = await updateClan(req.params.id as string, ctx.userId, body);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }
    res.json(result.clan);
}

// ─── DELETE /clans/:id ──────────────────────────────────────────────────────

export async function handleDeleteClan(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const result = await deleteClan(req.params.id as string, ctx.userId);
    if ("error" in result) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: result.error });
        return;
    }
    res.json({ ok: true });
}

// ─── POST /clans/:id/join ───────────────────────────────────────────────────

export async function handleJoinClan(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    if (ctx.isGuest) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Visitantes não podem entrar em clãs." });
        return;
    }

    const result = await joinClan(req.params.id as string, ctx.userId);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }
    res.json(result);
}

// ─── POST /clans/invite/:code ───────────────────────────────────────────────

export async function handleJoinByInvite(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    if (ctx.isGuest) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Visitantes não podem entrar em clãs." });
        return;
    }

    const result = await joinClanByInvite(req.params.code as string, ctx.userId);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }
    res.json(result.clan);
}

// ─── POST /clans/:id/leave ──────────────────────────────────────────────────

export async function handleLeaveClan(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const result = await leaveClan(req.params.id as string, ctx.userId);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }
    res.json({ ok: true });
}

// ─── POST /clans/:id/members/:userId/accept ─────────────────────────────────

export async function handleAcceptMember(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const result = await acceptMember(req.params.id as string, req.params.userId as string, ctx.userId);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }
    res.json({ ok: true });
}

// ─── POST /clans/:id/members/:userId/reject ─────────────────────────────────

export async function handleRejectMember(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const result = await rejectMember(req.params.id as string, req.params.userId as string, ctx.userId);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }
    res.json({ ok: true });
}

// ─── POST /clans/:id/members/:userId/kick ───────────────────────────────────

export async function handleKickMember(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const result = await kickMember(req.params.id as string, req.params.userId as string, ctx.userId);
    if ("error" in result) {
        res.status(422).json({ statusCode: 422, error: "Unprocessable Entity", message: result.error });
        return;
    }
    res.json({ ok: true });
}

// ─── POST /clans/:id/invite ─────────────────────────────────────────────────

export async function handleRegenerateInvite(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const result = await regenerateInvite(req.params.id as string, ctx.userId);
    if ("error" in result) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: result.error });
        return;
    }
    res.json(result);
}

// ─── POST /clans/:id/avatar ─────────────────────────────────────────────────

export async function handleUploadClanAvatar(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const clanId = req.params.id as string;

    const clan = await getClanById(clanId);
    if (!clan) {
        res.status(404).json({ statusCode: 404, error: "Not Found", message: "Clã não encontrado." });
        return;
    }
    if (clan.ownerId !== ctx.userId) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Apenas o dono pode alterar o avatar." });
        return;
    }

    const file = req.file;
    if (!file) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Nenhum arquivo enviado." });
        return;
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
        res.status(400).json({ statusCode: 400, error: "Bad Request", message: "Formato não suportado." });
        return;
    }

    const ext = file.originalname.split(".").pop() ?? "png";
    const path = `${clanId}/avatar.${ext}`;

    const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
        res.status(500).json({ statusCode: 500, error: "Internal", message: "Falha no upload." });
        return;
    }

    const avatarUrl = `${ENV.SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
    await updateClanAvatar(clanId, avatarUrl);

    const updated = await getClanById(clanId);
    res.json(updated);
}

// ─── GET /clans/:id/messages ────────────────────────────────────────────────

export async function handleGetClanMessages(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    const clanId = req.params.id as string;

    const member = await isClanMember(clanId, ctx.userId);
    if (!member) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Apenas membros podem ver o chat." });
        return;
    }

    const messages = await getClanMessages(clanId);
    res.json(messages);
}
