// ─── Environment Variables ──────────────────────────────────────────────────
// Centralises all env access with defaults.

export const ENV = {
    PORT: Number(process.env.PORT ?? 3001),
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    JWT_SECRET: process.env.JWT_SECRET ?? "izma-dev-secret-change-in-production",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "2h",
    REFRESH_EXPIRES_IN: process.env.REFRESH_EXPIRES_IN ?? "7d",
    BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS ?? 12),
    /** Max login/register attempts per minute per IP */
    RATE_LIMIT_AUTH_PER_MINUTE: Number(process.env.RATE_LIMIT_AUTH ?? 10),
    NODE_ENV: process.env.NODE_ENV ?? "development",
} as const;
