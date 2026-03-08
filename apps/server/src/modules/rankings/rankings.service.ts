// ─── Rankings Service ───────────────────────────────────────────────────────
// Queries for coin and victory leaderboards across different time periods.

import type { RankingPeriod, RankedUser } from "@izma/types";
import { query } from "../../db.ts";

const LIMIT = 50;

/** Date filter SQL for each period. */
function periodFilter(period: RankingPeriod): string {
    switch (period) {
        case "daily":
            return "AND ct.created_at >= NOW() - INTERVAL '1 day'";
        case "weekly":
            return "AND ct.created_at >= NOW() - INTERVAL '7 days'";
        case "monthly":
            return "AND ct.created_at >= NOW() - INTERVAL '30 days'";
        case "all":
        default:
            return "";
    }
}

/**
 * Top users by total coins (from users table — accumulated balance).
 * Period is ignored since coins is a running balance.
 */
export async function getTopCoins(): Promise<RankedUser[]> {
    const result = await query(
        `SELECT u.id       AS user_id,
                u.username,
                u.avatar_url,
                u.coins    AS value
         FROM users u
         WHERE u.is_guest = false
         ORDER BY u.coins DESC
         LIMIT $1`,
        [LIMIT],
    );

    return result.rows.map((row: any, i: number) => ({
        rank: i + 1,
        userId: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
        value: row.value,
    }));
}

/**
 * Top users by number of victories in a given time period.
 * A "victory" = a VICTORY coin_transaction record.
 */
export async function getTopVictories(period: RankingPeriod): Promise<RankedUser[]> {
    const filter = periodFilter(period);

    const result = await query(
        `SELECT ct.user_id,
                u.username,
                u.avatar_url,
                COUNT(*)::int AS value
         FROM coin_transactions ct
         JOIN users u ON u.id = ct.user_id
         WHERE ct.reason = 'VICTORY'
         ${filter}
         GROUP BY ct.user_id, u.username, u.avatar_url
         ORDER BY value DESC
         LIMIT $1`,
        [LIMIT],
    );

    return result.rows.map((row: any, i: number) => ({
        rank: i + 1,
        userId: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
        value: row.value,
    }));
}
