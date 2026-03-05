// ─── Generic Score Bar ──────────────────────────────────────────────────────
// Works with any game state that extends BaseGameState (has `scores`).

import type { Room, BaseGameState } from "@izma/types";
import styles from "./ScoreBar.module.css";

interface ScoreBarProps {
    room: Room;
    gameState: BaseGameState;
    currentPlayerId?: string | null;
}

export default function ScoreBar({ room, gameState, currentPlayerId }: ScoreBarProps) {
    return (
        <div className={styles.scoreBar}>
            {room.players
                .slice()
                .sort((a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0))
                .map((p, i) => (
                    <div key={p.id} className={styles.scoreChip}>
                        <span className={styles.rank}>{i + 1}</span>
                        <span className={styles.chipName}>
                            {p.nickname}
                            {p.id === currentPlayerId && " (você)"}
                        </span>
                        <span className={styles.chipScore}>{gameState.scores[p.id] ?? 0}</span>
                    </div>
                ))}
        </div>
    );
}
