import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Redis before importing rooms module
vi.mock("../src/redis.ts", () => ({
    redis: {
        set: vi.fn().mockResolvedValue("OK"),
        get: vi.fn().mockResolvedValue(null),
        del: vi.fn().mockResolvedValue(1),
        persist: vi.fn().mockResolvedValue(1),
    },
}));

import {
    getRoom,
    setRoom,
    deleteRoom,
    getAllRooms,
    broadcast,
    sendTo,
    roomSnapshot,
    removePlayer,
} from "../src/rooms";
import type { LiveRoom, LivePlayer } from "../src/types";
import type { ServerMessage } from "@izma/protocol";

function mockWs(): any {
    return {
        send: vi.fn(),
        readyState: 1,
    };
}

function makeLivePlayer(id: string, opts: Partial<LivePlayer> = {}): LivePlayer {
    return {
        id,
        nickname: opts.nickname ?? `Player_${id}`,
        score: opts.score ?? 0,
        status: opts.status ?? "waiting",
        isHost: opts.isHost ?? false,
        userId: opts.userId ?? null,
        avatarUrl: opts.avatarUrl ?? null,
        bio: opts.bio ?? null,
        ws: opts.ws ?? mockWs(),
    };
}

function makeRoom(id: string, players: LivePlayer[]): LiveRoom {
    return {
        id,
        hostId: players[0]?.id ?? "h",
        players,
        state: "lobby",
        maxPlayers: 4,
        isPrivate: false,
        gameId: "reaction",
        games: {
            totalRounds: 5,
            mode: "MANUAL",
            selectedGameIds: ["reaction"],
        },
        currentGameIndex: 0,
        gameState: null,
        engine: null,
    };
}

describe("rooms CRUD", () => {
    beforeEach(() => {
        // Clear rooms between tests by deleting known rooms
        for (const r of getAllRooms()) {
            deleteRoom(r.id);
        }
    });

    it("setRoom and getRoom store and retrieve a room", () => {
        const p = makeLivePlayer("p1", { isHost: true });
        const room = makeRoom("ROOM1", [p]);
        setRoom(room);
        expect(getRoom("ROOM1")).toBe(room);
    });

    it("getRoom returns undefined for non-existent room", () => {
        expect(getRoom("NOROOM")).toBeUndefined();
    });

    it("deleteRoom removes a room", () => {
        const room = makeRoom("DEL1", [makeLivePlayer("p1", { isHost: true })]);
        setRoom(room);
        deleteRoom("DEL1");
        expect(getRoom("DEL1")).toBeUndefined();
    });

    it("getAllRooms returns all stored rooms", () => {
        const room1 = makeRoom("R1", [makeLivePlayer("p1", { isHost: true })]);
        const room2 = makeRoom("R2", [makeLivePlayer("p2", { isHost: true })]);
        setRoom(room1);
        setRoom(room2);
        const all = getAllRooms();
        expect(all.length).toBe(2);
        expect(all.map((r) => r.id).sort()).toEqual(["R1", "R2"]);
    });
});

describe("broadcast", () => {
    it("sends message to all players", () => {
        const ws1 = mockWs();
        const ws2 = mockWs();
        const room = makeRoom("B1", [
            makeLivePlayer("p1", { ws: ws1, isHost: true }),
            makeLivePlayer("p2", { ws: ws2 }),
        ]);

        const msg: ServerMessage = { type: "ERROR", payload: { message: "test" } };
        broadcast(room, msg);

        expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(msg));
        expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(msg));
    });

    it("does not throw if ws.send throws", () => {
        const ws1 = mockWs();
        ws1.send.mockImplementation(() => { throw new Error("dead socket"); });
        const room = makeRoom("B2", [makeLivePlayer("p1", { ws: ws1, isHost: true })]);

        expect(() =>
            broadcast(room, { type: "ERROR", payload: { message: "test" } }),
        ).not.toThrow();
    });
});

describe("sendTo", () => {
    it("sends message to a single player", () => {
        const ws = mockWs();
        const player = makeLivePlayer("p1", { ws });

        const msg: ServerMessage = { type: "JOINED", payload: { playerId: "p1", roomId: "R1" } };
        sendTo(player, msg);

        expect(ws.send).toHaveBeenCalledWith(JSON.stringify(msg));
    });

    it("does not throw on dead socket", () => {
        const ws = mockWs();
        ws.send.mockImplementation(() => { throw new Error("closed"); });
        const player = makeLivePlayer("p1", { ws });

        expect(() =>
            sendTo(player, { type: "ERROR", payload: { message: "test" } }),
        ).not.toThrow();
    });
});

describe("roomSnapshot", () => {
    it("returns a plain Room without ws references", () => {
        const ws = mockWs();
        const room = makeRoom("SNAP1", [
            makeLivePlayer("p1", { ws, isHost: true, nickname: "Alice" }),
            makeLivePlayer("p2", { ws: mockWs(), nickname: "Bob" }),
        ]);
        setRoom(room);

        const snap = roomSnapshot(room);

        expect(snap.id).toBe("SNAP1");
        expect(snap.players).toHaveLength(2);
        expect(snap.players[0]!.nickname).toBe("Alice");
        // Ensure no ws property leaked
        expect((snap.players[0] as any).ws).toBeUndefined();
    });

    it("includes game settings", () => {
        const room = makeRoom("SNAP2", [makeLivePlayer("p1", { isHost: true })]);
        room.games = {
            totalRounds: 3,
            mode: "RANDOM",
            selectedGameIds: ["reaction"],
        };
        const snap = roomSnapshot(room);
        expect(snap.games.mode).toBe("RANDOM");
        expect(snap.games.totalRounds).toBe(3);
    });
});

describe("removePlayer", () => {
    beforeEach(() => {
        for (const r of getAllRooms()) deleteRoom(r.id);
    });

    it("removes a player from a room", () => {
        const room = makeRoom("RM1", [
            makeLivePlayer("p1", { isHost: true }),
            makeLivePlayer("p2"),
        ]);
        setRoom(room);
        const empty = removePlayer(room, "p2");
        expect(empty).toBe(false);
        expect(room.players).toHaveLength(1);
        expect(room.players[0]!.id).toBe("p1");
    });

    it("returns true when the last player is removed", () => {
        const room = makeRoom("RM2", [
            makeLivePlayer("p1", { isHost: true }),
        ]);
        setRoom(room);
        const empty = removePlayer(room, "p1");
        expect(empty).toBe(true);
    });

    it("reassigns host when host is removed", () => {
        const room = makeRoom("RM3", [
            makeLivePlayer("p1", { isHost: true }),
            makeLivePlayer("p2"),
        ]);
        room.hostId = "p1";
        setRoom(room);

        removePlayer(room, "p1");
        expect(room.hostId).toBe("p2");
        expect(room.players[0]!.isHost).toBe(true);
    });
});
