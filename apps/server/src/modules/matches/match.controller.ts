// ─── Match History Controller ────────────────────────────────────────────────

import type { Request, Response } from "express";
import { getUserMatchHistory } from "./match.service.ts";

// ─── GET /matches/me ────────────────────────────────────────────────────────

export async function handleGetMyMatches(req: Request, res: Response): Promise<void> {
    const ctx = req.auth!;
    if (ctx.isGuest) {
        res.status(403).json({ statusCode: 403, error: "Forbidden", message: "Visitantes não possuem histórico." });
        return;
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const matches = await getUserMatchHistory(ctx.userId, limit, offset);
    res.json(matches);
}
