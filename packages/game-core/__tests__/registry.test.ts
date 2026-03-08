import { describe, it, expect, beforeEach } from "vitest";

// We test the registry in isolation, with a fresh import per describe block.
// Since engines auto-register on import of the package, we need to test that too.

describe("game-core registry", () => {
    it("exports registerEngine, createEngine, getRegisteredEngines", async () => {
        const mod = await import("../registry");
        expect(typeof mod.registerEngine).toBe("function");
        expect(typeof mod.createEngine).toBe("function");
        expect(typeof mod.getRegisteredEngines).toBe("function");
    });

    it("throws when creating an unregistered engine", async () => {
        const { createEngine } = await import("../registry");
        const players = [
            { id: "p1", nickname: "A", score: 0, status: "playing" as const, isHost: true, userId: null, avatarUrl: null },
        ];
        expect(() => createEngine("nonexistent", players, () => { }, 3)).toThrow(
            /No engine registered for "nonexistent"/,
        );
    });
});

describe("auto-registered engines", () => {
    it("registers reaction and color-match on import", async () => {
        // Import the index which triggers auto-registration
        const { getRegisteredEngines } = await import("../index");
        const engines = getRegisteredEngines();
        expect(engines).toContain("reaction");
        expect(engines).toContain("color-match");
    });
});
