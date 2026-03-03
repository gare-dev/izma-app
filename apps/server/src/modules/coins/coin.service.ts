// ─── Coin Service ───────────────────────────────────────────────────────────
// Awards coins after a game. Only registered users receive coins.
// All coin mutations happen server-side — never trust the frontend.
// Uses PostgreSQL for transaction log and balance updates.

import type { CoinTransaction } from "@izma/types";
import { query } from "../../db.ts";
import { addCoinsToUser, getUserBalance } from "../auth/auth.service.ts";

// ─── Constants ──────────────────────────────────────────────────────────────

export const COINS = {
    VICTORY: 10,
    PARTICIPATION: 2,
} as const;

// ─── Award ──────────────────────────────────────────────────────────────────

export interface CoinAwardResult {
    userId: string;
    delta: number;
    newBalance: number;
    reason: CoinTransaction["reason"];
}

/**
 * Award coins to a user. Inserts into coin_transactions and updates users.coins.
 * Returns null if the user is a guest or not found.
 */
export async function awardCoins(
    userId: string,
    reason: CoinTransaction["reason"],
    roomId: string,
): Promise<CoinAwardResult | null> {
    const amount = reason === "VICTORY" ? COINS.VICTORY : COINS.PARTICIPATION;

    // Update user balance in DB
    const newBalance = await addCoinsToUser(userId, amount);
    if (newBalance === null) return null; // guest or not found

    // Insert transaction log into DB
    await query(
        `INSERT INTO coin_transactions (user_id, amount, reason, room_id)
         VALUES ($1, $2, $3::coin_reason, $4)`,
        [userId, amount, reason, roomId],
    );

    return { userId, delta: amount, newBalance, reason };
}

/**
 * Get a user's coin balance. Returns null for guests.
 */
export async function getBalance(userId: string): Promise<number | null> {
    return getUserBalance(userId);
}

/**
 * Get transaction history for a user.
 */
export async function getTransactions(userId: string): Promise<CoinTransaction[]> {
    const result = await query(
        `SELECT user_id, amount, reason, room_id, created_at
         FROM coin_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId],
    );

    return result.rows.map((row: any) => ({
        userId: row.user_id,
        amount: row.amount,
        reason: row.reason,
        roomId: row.room_id,
        timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    }));
}
