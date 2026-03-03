// ─── Password Hashing ───────────────────────────────────────────────────────
// Uses Bun's built-in bcrypt via `Bun.password` (available since Bun 1.0).
// Falls back to a simple hash if the API isn't available (shouldn't happen on Bun).

import { ENV } from "../../utils/env.ts";

export async function hashPassword(plain: string): Promise<string> {
    return Bun.password.hash(plain, {
        algorithm: "bcrypt",
        cost: ENV.BCRYPT_ROUNDS,
    });
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
    return Bun.password.verify(plain, hash);
}
