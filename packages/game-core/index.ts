import type { Player, BaseGameState } from "@izma/types";
import type { ServerMessage } from "@izma/protocol";

// ─── Engine Interface ───────────────────────────────────────────────────────

export interface GameEngine {
    /** Unique game identifier (matches the DB games.id). */
    readonly gameId: string;
    /** Called once to start the game after the lobby countdown. */
    init(): void;
    /** Handle an action emitted by a player. */
    onPlayerAction(playerId: string, action: string, data?: unknown): void;
    /** Return the current serialisable game state. */
    getState(): BaseGameState;
    /** Forcefully terminate the game (e.g. player disconnected). */
    destroy(): void;
}

// ─── Engine Factory & Registry ──────────────────────────────────────────────

export type BroadcastFn = (msg: ServerMessage) => void;

export type GameEngineFactory = (
    players: Player[],
    broadcast: BroadcastFn,
    totalRounds: number,
) => GameEngine;

const engineRegistry = new Map<string, GameEngineFactory>();

/** Register a server-side engine for a gameId. */
export function registerEngine(gameId: string, factory: GameEngineFactory): void {
    engineRegistry.set(gameId, factory);
}

/** Create a GameEngine instance for the given gameId. */
export function createEngine(
    gameId: string,
    players: Player[],
    broadcast: BroadcastFn,
    totalRounds: number,
): GameEngine {
    const factory = engineRegistry.get(gameId);
    if (!factory) throw new Error(`[game-core] No engine registered for "${gameId}".`);
    return factory(players, broadcast, totalRounds);
}

/** List all registered game engine IDs. */
export function getRegisteredEngines(): string[] {
    return [...engineRegistry.keys()];
}

// ─── Built-in Engines ───────────────────────────────────────────────────────
// Each engine lives under engines/<gameId>.ts and auto-registers itself.
// Import them here so they register when the package is loaded.

import "./engines/reaction";
