import type { Player, Room } from "@izma/types";

// Server-side WebSocket client data
export interface WsData {
    id: string;         // unique connection/player id
    roomId: string | null;
}

// Extended room that holds live WS connections
export interface LiveRoom extends Omit<Room, "players"> {
    players: LivePlayer[];
    engine: import("@izma/game-core").GameEngine | null;
}

export interface LivePlayer extends Player {
    ws: import("bun").ServerWebSocket<WsData>;
}
