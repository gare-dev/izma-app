import { describe, it, expect } from "vitest";
import { parseClientMessage, serializeServerMessage } from "../index";

// ─── parseClientMessage ─────────────────────────────────────────────────────

describe("parseClientMessage", () => {
    it("parses a valid CREATE_ROOM message", () => {
        const raw = JSON.stringify({
            type: "CREATE_ROOM",
            payload: {
                nickname: "Alice",
                maxPlayers: 4,
                gameId: "reaction",
                games: {
                    totalRounds: 5,
                    mode: "MANUAL",
                    selectedGameIds: ["reaction"],
                },
                isPrivate: false,
            },
        });
        const msg = parseClientMessage(raw);
        expect(msg).not.toBeNull();
        expect(msg!.type).toBe("CREATE_ROOM");
    });

    it("parses a valid JOIN_ROOM message", () => {
        const raw = JSON.stringify({
            type: "JOIN_ROOM",
            payload: { roomId: "ABC123", nickname: "Bob" },
        });
        const msg = parseClientMessage(raw);
        expect(msg).not.toBeNull();
        expect(msg!.type).toBe("JOIN_ROOM");
    });

    it("parses SET_READY (no payload)", () => {
        const raw = JSON.stringify({ type: "SET_READY" });
        const msg = parseClientMessage(raw);
        expect(msg).not.toBeNull();
        expect(msg!.type).toBe("SET_READY");
    });

    it("parses START_GAME", () => {
        const msg = parseClientMessage(JSON.stringify({ type: "START_GAME" }));
        expect(msg?.type).toBe("START_GAME");
    });

    it("parses PLAYER_ACTION", () => {
        const raw = JSON.stringify({
            type: "PLAYER_ACTION",
            payload: { action: "REACT" },
        });
        const msg = parseClientMessage(raw);
        expect(msg?.type).toBe("PLAYER_ACTION");
    });

    it("parses AUTH message", () => {
        const raw = JSON.stringify({
            type: "AUTH",
            payload: { token: "some-jwt" },
        });
        const msg = parseClientMessage(raw);
        expect(msg?.type).toBe("AUTH");
    });

    it("parses LIST_ROOMS", () => {
        const msg = parseClientMessage(JSON.stringify({ type: "LIST_ROOMS" }));
        expect(msg?.type).toBe("LIST_ROOMS");
    });

    it("parses JOIN_RANDOM", () => {
        const raw = JSON.stringify({
            type: "JOIN_RANDOM",
            payload: { nickname: "TestUser" },
        });
        const msg = parseClientMessage(raw);
        expect(msg?.type).toBe("JOIN_RANDOM");
    });

    it("parses RECONNECT", () => {
        const msg = parseClientMessage(JSON.stringify({ type: "RECONNECT" }));
        expect(msg?.type).toBe("RECONNECT");
    });

    it("returns null for invalid JSON", () => {
        expect(parseClientMessage("not json")).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(parseClientMessage("")).toBeNull();
    });

    it("returns null for malformed JSON", () => {
        expect(parseClientMessage("{type:}")).toBeNull();
    });
});

// ─── serializeServerMessage ─────────────────────────────────────────────────

describe("serializeServerMessage", () => {
    it("serialises a JOINED message", () => {
        const msg = {
            type: "JOINED" as const,
            payload: { playerId: "p1", roomId: "ROOM1" },
        };
        const json = serializeServerMessage(msg);
        const parsed = JSON.parse(json);
        expect(parsed.type).toBe("JOINED");
        expect(parsed.payload.playerId).toBe("p1");
        expect(parsed.payload.roomId).toBe("ROOM1");
    });

    it("serialises an ERROR message", () => {
        const msg = {
            type: "ERROR" as const,
            payload: { message: "Algo deu errado" },
        };
        const json = serializeServerMessage(msg);
        const parsed = JSON.parse(json);
        expect(parsed.type).toBe("ERROR");
        expect(parsed.payload.message).toBe("Algo deu errado");
    });

    it("serialises a GAME_STATE message", () => {
        const msg = {
            type: "GAME_STATE" as const,
            payload: {
                gameState: {
                    gameId: "reaction" as const,
                    phase: "countdown" as const,
                    round: 1,
                    totalRounds: 5,
                    scores: { p1: 0 },
                    countdown: 3,
                    winner: null,
                    falseStarter: null,
                    lastReactionTime: null,
                },
            },
        };
        const json = serializeServerMessage(msg);
        const parsed = JSON.parse(json);
        expect(parsed.type).toBe("GAME_STATE");
        expect(parsed.payload.gameState.gameId).toBe("reaction");
    });

    it("serialises a GAME_END message", () => {
        const msg = {
            type: "GAME_END" as const,
            payload: {
                scores: { p1: 3, p2: 2 },
                rounds: [
                    { round: 1, winnerId: "p1" },
                    { round: 2, winnerId: "p2" },
                ],
                mvp: "p1",
            },
        };
        const json = serializeServerMessage(msg);
        const parsed = JSON.parse(json);
        expect(parsed.type).toBe("GAME_END");
        expect(parsed.payload.mvp).toBe("p1");
        expect(parsed.payload.rounds).toHaveLength(2);
    });

    it("serialises a ROOM_LIST message", () => {
        const msg = {
            type: "ROOM_LIST" as const,
            payload: {
                rooms: [
                    {
                        id: "ABC",
                        hostNickname: "Host",
                        playerCount: 2,
                        maxPlayers: 4,
                        gameIds: ["reaction"],
                        state: "lobby" as const,
                    },
                ],
            },
        };
        const json = serializeServerMessage(msg);
        const parsed = JSON.parse(json);
        expect(parsed.type).toBe("ROOM_LIST");
        expect(parsed.payload.rooms).toHaveLength(1);
    });

    it("serialises a COINS_UPDATE message", () => {
        const msg = {
            type: "COINS_UPDATE" as const,
            payload: {
                userId: "u1",
                coins: 110,
                delta: 10,
                reason: "VICTORY",
            },
        };
        const json = serializeServerMessage(msg);
        const parsed = JSON.parse(json);
        expect(parsed.type).toBe("COINS_UPDATE");
        expect(parsed.payload.delta).toBe(10);
    });

    it("produces valid JSON output", () => {
        const msg = {
            type: "AUTH_OK" as const,
            payload: { userId: "u1", username: "tester" },
        };
        expect(() => JSON.parse(serializeServerMessage(msg))).not.toThrow();
    });

    it("roundtrips correctly (serialize → parse)", () => {
        const original = {
            type: "ROOM_GAMES_DEFINED" as const,
            payload: { totalRounds: 5, gameOrder: ["reaction", "color-match"] },
        };
        const json = serializeServerMessage(original);
        const parsed = JSON.parse(json);
        expect(parsed).toEqual(original);
    });
});
