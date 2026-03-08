import { describe, it, expect } from "vitest";
import { getWsData, setWsData } from "../src/ws-data";

// Minimal mock that satisfies the WeakMap key requirement
function mockWs(): any {
    return { send: () => { }, readyState: 1 };
}

describe("ws-data store", () => {
    it("setWsData stores data that getWsData retrieves", () => {
        const ws = mockWs();
        const data = { id: "conn1", roomId: null, userId: null, username: "guest", isGuest: true };

        setWsData(ws, data);
        expect(getWsData(ws)).toBe(data);
    });

    it("returns undefined for unknown WebSocket", () => {
        const ws = mockWs();
        // getWsData uses non-null assertion internally, but the WeakMap returns undefined
        expect(getWsData(ws)).toBeUndefined();
    });

    it("overwrites data when set again", () => {
        const ws = mockWs();
        const data1 = { id: "c1", roomId: null, userId: null, username: "a", isGuest: true };
        const data2 = { id: "c2", roomId: "ROOM1", userId: "u1", username: "b", isGuest: false };

        setWsData(ws, data1);
        setWsData(ws, data2);
        expect(getWsData(ws)).toBe(data2);
    });

    it("keeps data isolated per WebSocket", () => {
        const ws1 = mockWs();
        const ws2 = mockWs();
        const d1 = { id: "a", roomId: null, userId: null, username: "a", isGuest: true };
        const d2 = { id: "b", roomId: "R1", userId: "u2", username: "b", isGuest: false };

        setWsData(ws1, d1);
        setWsData(ws2, d2);

        expect(getWsData(ws1)).toBe(d1);
        expect(getWsData(ws2)).toBe(d2);
    });
});
