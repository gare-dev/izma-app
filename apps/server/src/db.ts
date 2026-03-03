// ─── PostgreSQL Pool ────────────────────────────────────────────────────────
// Connection pool using `pg`. Connects to Supabase PostgreSQL.

import { Pool } from "pg";
import { ENV } from "./utils/env.ts";

export const pool = new Pool({
    connectionString: ENV.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
    console.error("[db] Unexpected pool error:", err.message);
});

/** Convenience wrapper for pool.query */
export async function query<T extends import("pg").QueryResultRow = any>(
    text: string,
    params?: unknown[],
): Promise<import("pg").QueryResult<T>> {
    return pool.query<T>(text, params);
}

/** Test the connection on startup */
export async function testConnection(): Promise<void> {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT NOW()");
        console.log("[db] Connected to PostgreSQL at", res.rows[0].now);
    } finally {
        client.release();
    }
}
