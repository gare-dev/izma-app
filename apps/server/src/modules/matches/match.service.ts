// ─── Match History Service ───────────────────────────────────────────────────
// Persists match results and queries user match history.

import { v4 as uuid } from "uuid";
import type { MatchSummary, MatchPlayerSummary } from "@izma/types";
import { query } from "../../db.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SaveMatchInput {
    roomId: string;
    gameIds: string[];
    /** Sorted by score descending — position is derived from index. */
    players: { userId: string; nickname: string; score: number }[];
    mvpUserId: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function rowToSummary(row: any, players: MatchPlayerSummary[]): MatchSummary {
    return {
        id: row.id,
        roomId: row.room_id,
        gameIds: row.game_ids,
        playerCount: row.player_count,
        mvpUserId: row.mvp_user_id,
        playedAt: row.played_at instanceof Date ? row.played_at.toISOString() : row.played_at,
        players,
    };
}

function rowToPlayer(row: any): MatchPlayerSummary {
    return {
        userId: row.user_id,
        nickname: row.nickname,
        score: row.score,
        position: row.position,
        isMvp: row.is_mvp,
    };
}

// ─── Save Match ─────────────────────────────────────────────────────────────

export async function saveMatch(input: SaveMatchInput): Promise<string> {
    const matchId = uuid();

    await query(
        `INSERT INTO matches (id, room_id, game_ids, player_count, mvp_user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [matchId, input.roomId, input.gameIds, input.players.length, input.mvpUserId],
    );

    // Insert all players with their position (1-based)
    for (let i = 0; i < input.players.length; i++) {
        const p = input.players[i]!;
        await query(
            `INSERT INTO match_players (match_id, user_id, nickname, score, position, is_mvp)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [matchId, p.userId, p.nickname, p.score, i + 1, p.userId === input.mvpUserId],
        );
    }

    return matchId;
}

// ─── Get User Match History ─────────────────────────────────────────────────

export async function getUserMatchHistory(
    userId: string,
    limit = 20,
    offset = 0,
): Promise<MatchSummary[]> {
    // Get match IDs for this user, ordered by most recent
    const matchesResult = await query(
        `SELECT m.*
         FROM matches m
         JOIN match_players mp ON mp.match_id = m.id
         WHERE mp.user_id = $1
         ORDER BY m.played_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
    );

    if ((matchesResult.rowCount ?? 0) === 0) return [];

    const matchIds = matchesResult.rows.map((r: any) => r.id);

    // Get all players for these matches in one query
    const playersResult = await query(
        `SELECT mp.*
         FROM match_players mp
         WHERE mp.match_id = ANY($1)
         ORDER BY mp.position ASC`,
        [matchIds],
    );

    // Group players by match
    const playersByMatch = new Map<string, MatchPlayerSummary[]>();
    for (const row of playersResult.rows) {
        const list = playersByMatch.get(row.match_id) ?? [];
        list.push(rowToPlayer(row));
        playersByMatch.set(row.match_id, list);
    }

    return matchesResult.rows.map((row: any) =>
        rowToSummary(row, playersByMatch.get(row.id) ?? []),
    );
}
