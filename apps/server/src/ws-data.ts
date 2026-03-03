// ─── WebSocket Data Store ────────────────────────────────────────────────────
// WeakMap-based store to attach WsData to ws WebSocket instances.
// Separate module to avoid circular imports between index.ts and handlers.ts.

import type { WebSocket } from "ws";
import type { WsData } from "./types.ts";

const wsDataMap = new WeakMap<WebSocket, WsData>();

/** Get WsData for a WebSocket */
export function getWsData(ws: WebSocket): WsData {
    return wsDataMap.get(ws)!;
}

/** Set WsData for a WebSocket */
export function setWsData(ws: WebSocket, data: WsData): void {
    wsDataMap.set(ws, data);
}
