import { describe, it, expect } from "vitest";
import {
    isNonEmptyString,
    isValidEmail,
    isValidUrl,
    clamp,
    sanitize,
    fail,
    ok,
} from "../src/utils/validation";

describe("isNonEmptyString", () => {
    it("returns true for non-empty strings", () => {
        expect(isNonEmptyString("hello")).toBe(true);
        expect(isNonEmptyString("  a  ")).toBe(true);
    });

    it("returns false for empty/whitespace/non-string", () => {
        expect(isNonEmptyString("")).toBe(false);
        expect(isNonEmptyString("   ")).toBe(false);
        expect(isNonEmptyString(null)).toBe(false);
        expect(isNonEmptyString(undefined)).toBe(false);
        expect(isNonEmptyString(123)).toBe(false);
        expect(isNonEmptyString({})).toBe(false);
    });
});

describe("isValidEmail", () => {
    it("accepts valid emails", () => {
        expect(isValidEmail("user@example.com")).toBe(true);
        expect(isValidEmail("test.user@domain.co")).toBe(true);
        expect(isValidEmail("a@b.c")).toBe(true);
    });

    it("rejects invalid emails", () => {
        expect(isValidEmail("")).toBe(false);
        expect(isValidEmail("notanemail")).toBe(false);
        expect(isValidEmail("@no-user.com")).toBe(false);
        expect(isValidEmail("user@")).toBe(false);
        expect(isValidEmail("user @domain.com")).toBe(false);
        expect(isValidEmail(null)).toBe(false);
        expect(isValidEmail(42)).toBe(false);
    });
});

describe("isValidUrl", () => {
    it("accepts valid URLs", () => {
        expect(isValidUrl("https://example.com")).toBe(true);
        expect(isValidUrl("http://localhost:3000")).toBe(true);
        expect(isValidUrl("ftp://files.example.com/file.txt")).toBe(true);
    });

    it("rejects invalid URLs", () => {
        expect(isValidUrl("not-a-url")).toBe(false);
        expect(isValidUrl("")).toBe(false);
        expect(isValidUrl(null)).toBe(false);
        expect(isValidUrl(123)).toBe(false);
    });
});

describe("clamp", () => {
    it("clamps below minimum", () => {
        expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("clamps above maximum", () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });

    it("returns value when within range", () => {
        expect(clamp(5, 0, 10)).toBe(5);
    });

    it("handles edges", () => {
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
    });
});

describe("sanitize", () => {
    it("strips HTML tags", () => {
        expect(sanitize("<b>bold</b>")).toBe("bold");
        expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it("trims whitespace", () => {
        expect(sanitize("  hello  ")).toBe("hello");
    });

    it("limits length to maxLength", () => {
        const long = "a".repeat(300);
        expect(sanitize(long, 100).length).toBe(100);
    });

    it("uses default maxLength of 200", () => {
        const long = "b".repeat(250);
        expect(sanitize(long).length).toBe(200);
    });

    it("handles nested tags", () => {
        expect(sanitize("<div><p>text</p></div>")).toBe("text");
    });
});

describe("fail / ok", () => {
    it("fail returns { ok: false, message }", () => {
        const result = fail("Something wrong");
        expect(result).toEqual({ ok: false, message: "Something wrong" });
    });

    it("ok returns { ok: true }", () => {
        const result = ok();
        expect(result).toEqual({ ok: true });
    });
});
