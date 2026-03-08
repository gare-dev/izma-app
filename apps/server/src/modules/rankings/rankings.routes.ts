// ─── Rankings Routes ────────────────────────────────────────────────────────
// Express Router for /rankings/* endpoints.

import { Router } from "express";
import type { RankingPeriod } from "@izma/types";
import { getTopCoins, getTopVictories } from "./rankings.service.ts";

export const rankingsRouter = Router();

const VALID_PERIODS = new Set<RankingPeriod>(["daily", "weekly", "monthly", "all"]);

/** GET /rankings/coins — Top users by total coin balance */
rankingsRouter.get("/coins", async (_req, res) => {
    try {
        const entries = await getTopCoins();
        res.json({ period: "all", type: "coins", entries });
    } catch (err: any) {
        console.error("[rankings] coins error:", err.message);
        res.status(500).json({ message: "Erro ao buscar ranking de moedas." });
    }
});

/** GET /rankings/victories?period=daily|weekly|monthly|all */
rankingsRouter.get("/victories", async (req, res) => {
    const period = (req.query.period as string) || "all";
    if (!VALID_PERIODS.has(period as RankingPeriod)) {
        res.status(400).json({ message: "Período inválido. Use: daily, weekly, monthly, all." });
        return;
    }

    try {
        const entries = await getTopVictories(period as RankingPeriod);
        res.json({ period, type: "victories", entries });
    } catch (err: any) {
        console.error("[rankings] victories error:", err.message);
        res.status(500).json({ message: "Erro ao buscar ranking de vitórias." });
    }
});
