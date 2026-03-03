// ─── Input Validation Helpers ────────────────────────────────────────────────
// Lightweight validators — no external dep needed (zod is available if preferred).

export function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export function isValidEmail(value: unknown): value is string {
    if (typeof value !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

export function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

/** Strip HTML tags and limit length to prevent XSS / abuse. */
export function sanitize(input: string, maxLength = 200): string {
    return input.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

// ─── DTO Validation Results ─────────────────────────────────────────────────

export type ValidationResult =
    | { ok: true }
    | { ok: false; message: string };

export function fail(message: string): ValidationResult {
    return { ok: false, message };
}

export function ok(): ValidationResult {
    return { ok: true };
}
