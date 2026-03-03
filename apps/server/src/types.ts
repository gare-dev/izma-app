import type { Player, Room, RoomGameSettings } from "@izma/types";
import type { WebSocket } from "ws";

// Server-side WebSocket client data
export interface WsData {
    id: string;         // unique connection/player id
    roomId: string | null;
    /** Set after AUTH message — null means guest / unauthenticated */
    userId: string | null;
    username: string | null;
    isGuest: boolean;
}

// Extended room that holds live WS connections
export interface LiveRoom extends Omit<Room, "players"> {
    players: LivePlayer[];
    engine: import("@izma/game-core").GameEngine | null;
    games: RoomGameSettings;
    currentGameIndex: number;
}

export interface LivePlayer extends Player {
    ws: WebSocket;
}
