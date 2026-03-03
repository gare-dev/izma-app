// ─── Games Service ──────────────────────────────────────────────────────────
// Game catalog read from PostgreSQL `games` table.

import type { Game } from "@izma/types";
import { query } from "../../db.ts";

// ─── Row mapping ────────────────────────────────────────────────────────────

function rowToGame(row: any): Game {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        thumbnailUrl: row.thumbnail_url,
        minPlayers: row.min_players,
        maxPlayers: row.max_players,
        isActive: row.is_active,
    };
}

/** Returns only active games from DB. */
export async function getAvailableGames(): Promise<Game[]> {
    const result = await query(
        `SELECT id, name, description, thumbnail_url, min_players, max_players, is_active
         FROM games WHERE is_active = true ORDER BY name`,
    );
    return result.rows.map(rowToGame);
}

export async function getGameById(id: string): Promise<Game | undefined> {
    const result = await query(
        `SELECT id, name, description, thumbnail_url, min_players, max_players, is_active
         FROM games WHERE id = $1 AND is_active = true LIMIT 1`,
        [id],
    );
    if ((result.rowCount ?? 0) === 0) return undefined;
    return rowToGame(result.rows[0]);
}

/** Given a count, pick N random game IDs from the catalog. Allows repeats. */
export async function pickRandomGames(count: number): Promise<string[]> {
    const games = await getAvailableGames();
    if (games.length === 0) return [];
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * games.length);
        result.push(games[idx]!.id);
    }
    return result;
}
