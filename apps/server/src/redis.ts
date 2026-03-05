// ─── Redis Client ───────────────────────────────────────────────────────────
// Singleton ioredis instance. Used for caching, sessions, rate-limiting, etc.

import Redis from "ioredis";
import { ENV } from "./utils/env.ts";

export const redis = new Redis(ENV.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        // Exponential back-off capped at 3 s
        return Math.min(times * 200, 3000);
    },
    lazyConnect: true, // we call .connect() explicitly in start()
});

redis.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
});

redis.on("connect", () => {
    console.log("[redis] connected");
});

/** Test the connection on startup (called from index.ts) */
export async function testRedis(): Promise<void> {
    await redis.connect();
    await redis.ping();          // throws if unreachable
    console.log("[redis] PING → PONG ✓");
}
