import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../src/utils/env.ts", () => ({
    ENV: {
        BCRYPT_ROUNDS: 4, // low rounds for fast tests
    },
}));

// Mock Bun.password globally
const mockHash = vi.fn();
const mockVerify = vi.fn();

vi.stubGlobal("Bun", {
    password: {
        hash: mockHash,
        verify: mockVerify,
    },
});

import { hashPassword, comparePassword } from "../../src/modules/auth/password.service";

describe("password.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("hashPassword", () => {
        it("calls Bun.password.hash with bcrypt", async () => {
            mockHash.mockResolvedValue("$2b$04$hashed");

            const result = await hashPassword("my-password");

            expect(mockHash).toHaveBeenCalledWith("my-password", {
                algorithm: "bcrypt",
                cost: 4,
            });
            expect(result).toBe("$2b$04$hashed");
        });

        it("returns different hashes for different inputs", async () => {
            mockHash.mockResolvedValueOnce("hash-a");
            mockHash.mockResolvedValueOnce("hash-b");

            const a = await hashPassword("password-a");
            const b = await hashPassword("password-b");

            expect(a).not.toBe(b);
        });
    });

    describe("comparePassword", () => {
        it("returns true for matching password", async () => {
            mockVerify.mockResolvedValue(true);

            const result = await comparePassword("correct", "$2b$hash");
            expect(result).toBe(true);
        });

        it("returns false for non-matching password", async () => {
            mockVerify.mockResolvedValue(false);

            const result = await comparePassword("wrong", "$2b$hash");
            expect(result).toBe(false);
        });
    });

    // ── Security ────────────────────────────────────────────────────────────

    describe("security", () => {
        it("uses bcrypt algorithm (not plain/md5)", async () => {
            mockHash.mockResolvedValue("hashed");
            await hashPassword("test");
            expect(mockHash).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ algorithm: "bcrypt" }),
            );
        });

        it("never returns the plain password", async () => {
            const plain = "super-secret";
            mockHash.mockResolvedValue("$2b$hash$result");

            const hash = await hashPassword(plain);
            expect(hash).not.toBe(plain);
            expect(hash).not.toContain(plain);
        });
    });
});
