// ─── Games Controller ────────────────────────────────────────────────────────
// GET /games → returns the game catalog

import type { Request, Response } from "express";
import { getAvailableGames } from "./games.service.ts";

export async function handleGetGames(_req: Request, res: Response): Promise<void> {
    const games = await getAvailableGames();
    res.json(games);
}
