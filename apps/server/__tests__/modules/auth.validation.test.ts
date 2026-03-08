import { describe, it, expect } from "vitest";

// Test the synchronous auth validators (no DB calls needed)
// We import the validation functions from auth.service but
// only test the sync ones (validateLogin, validateGuest).
// validateRegister is async (DB check) and tested in integration tests.

import { validateLogin, validateGuest } from "../../src/modules/auth/auth.service";

describe("auth validation — validateLogin", () => {
    it("accepts valid credentials", () => {
        const result = validateLogin({ username: "alice", password: "secret123" });
        expect(result).toEqual({ ok: true });
    });

    it("rejects empty username", () => {
        const result = validateLogin({ username: "", password: "secret123" });
        expect(result.ok).toBe(false);
    });

    it("rejects empty password", () => {
        const result = validateLogin({ username: "alice", password: "" });
        expect(result.ok).toBe(false);
    });

    it("rejects whitespace-only username", () => {
        const result = validateLogin({ username: "   ", password: "secret123" });
        expect(result.ok).toBe(false);
    });
});

describe("auth validation — validateGuest", () => {
    it("accepts valid guest username", () => {
        const result = validateGuest({ username: "Player1" });
        expect(result).toEqual({ ok: true });
    });

    it("rejects empty username", () => {
        const result = validateGuest({ username: "" });
        expect(result.ok).toBe(false);
    });

    it("rejects username longer than 20 chars", () => {
        const result = validateGuest({ username: "A".repeat(21) });
        expect(result.ok).toBe(false);
    });

    it("accepts username of exactly 20 chars", () => {
        const result = validateGuest({ username: "A".repeat(20) });
        expect(result).toEqual({ ok: true });
    });
});
