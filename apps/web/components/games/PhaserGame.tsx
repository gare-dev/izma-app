// ─── Phaser Game Wrapper ────────────────────────────────────────────────────
// Mount a Phaser 3 game inside a React component. This file should ONLY be
// imported via `next/dynamic` with `{ ssr: false }` because Phaser needs the
// browser DOM.
//
// Usage:
//   import dynamic from "next/dynamic";
//   const PhaserGame = dynamic(() => import("@/components/games/PhaserGame"), { ssr: false });
//   <PhaserGame config={phaserConfig} gameState={state} onAction={fn} />

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { AnyGameState } from "@izma/types";

export interface PhaserGameProps {
    /** Full Phaser GameConfig (scenes, physics, etc). `parent` is set automatically. */
    config: Omit<Phaser.Types.Core.GameConfig, "parent">;
    /** Current game state from the server — forwarded to the active scene via event. */
    gameState?: AnyGameState;
    /** Callback to send a player action to the server. */
    onAction?: (action: string, data?: unknown) => void;
    /** Called once after the Phaser.Game instance is created. */
    onGameReady?: (game: Phaser.Game) => void;
}

/**
 * Renders a Phaser 3 canvas inside a div.
 *
 * The active scene receives:
 *   - `"stateUpdate"` event (via `this.events`) whenever `gameState` changes.
 *   - `this.registry.set("onAction", fn)` so scenes can call player actions.
 */
export default function PhaserGame({ config, gameState, onAction, onGameReady }: PhaserGameProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);

    // ── Mount / unmount Phaser ────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current || gameRef.current) return;

        const game = new Phaser.Game({
            ...config,
            parent: containerRef.current,
        });

        // Expose onAction to scenes via the global registry
        if (onAction) {
            game.registry.set("onAction", onAction);
        }

        gameRef.current = game;
        onGameReady?.(game);

        return () => {
            game.destroy(true);
            gameRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Forward onAction changes ─────────────────────────────────────────
    useEffect(() => {
        if (gameRef.current && onAction) {
            gameRef.current.registry.set("onAction", onAction);
        }
    }, [onAction]);

    // ── Forward game state to active scene ───────────────────────────────
    useEffect(() => {
        if (!gameRef.current || !gameState) return;
        const scenes = gameRef.current.scene.getScenes(true);
        for (const scene of scenes) {
            scene.events.emit("stateUpdate", gameState);
        }
    }, [gameState]);

    return (
        <div
            ref={containerRef}
            style={{ width: "100%", height: "100%", overflow: "hidden" }}
        />
    );
}
