// ─── Frontend Game Component Registry ────────────────────────────────────────
// Maps a gameId to the React component that renders that minigame.
// Each component receives a standard set of props so the room page
// can render ANY game without knowing its internals.

import type { ComponentType } from "react";
import type { Room, AnyGameState } from "@izma/types";

// ─── Props every game component receives ────────────────────────────────────

export interface GameComponentProps {
    room: Room;
    gameState: AnyGameState;
    playerId: string | null;
    /** Send a player action to the server (e.g. "REACT", "PICK_CARD") */
    onAction: (action: string, data?: unknown) => void;
}

// ─── Registry ───────────────────────────────────────────────────────────────

const componentRegistry = new Map<string, ComponentType<GameComponentProps>>();

/** Register a React component for a gameId. */
export function registerGameComponent(
    gameId: string,
    component: ComponentType<GameComponentProps>,
): void {
    componentRegistry.set(gameId, component);
}

/** Look up the component for a gameId. Returns null if not registered. */
export function getGameComponent(
    gameId: string,
): ComponentType<GameComponentProps> | null {
    return componentRegistry.get(gameId) ?? null;
}

/** List all registered game IDs (frontend). */
export function getRegisteredGameIds(): string[] {
    return [...componentRegistry.keys()];
}
