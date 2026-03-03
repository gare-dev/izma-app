import { useEffect } from "react";
import type { Game, GameSelectionMode } from "@izma/types";
import { useGameStore } from "@/store/useGameStore";
import styles from "./GameSelection.module.css";

/** Icons for known games — extend as new games are added */
const GAME_ICONS: Record<string, string> = {
    reaction: "⚡",
};

// ─── Single game card ──────────────────────────────────────────────────────

interface GameCardProps {
    game: Game;
    selected: boolean;
    onToggle: () => void;
    disabled?: boolean;
}

function GameCard({ game, selected, onToggle, disabled }: GameCardProps) {
    return (
        <div
            className={`${styles.card} ${selected ? styles.selected : ""}`}
            onClick={disabled ? undefined : onToggle}
            role="checkbox"
            aria-checked={selected}
        >
            <div className={styles.thumb}>{GAME_ICONS[game.id] ?? "🎮"}</div>
            <div className={styles.info}>
                <span className={styles.name}>{game.name}</span>
                <span className={styles.desc}>{game.description}</span>
            </div>
            <div className={`${styles.check} ${selected ? styles.checkSelected : ""}`}>
                {selected ? "✓" : ""}
            </div>
        </div>
    );
}

// ─── Full Game Selection Panel ─────────────────────────────────────────────

export default function GameSelection() {
    const {
        availableGames,
        selectedGameIds,
        totalRounds,
        selectionMode,
        fetchGames,
        setSelectionMode,
        setTotalRounds,
        toggleGameSelection,
    } = useGameStore();

    useEffect(() => {
        if (availableGames.length === 0) {
            fetchGames();
        }
    }, [availableGames.length, fetchGames]);

    const modes: { value: GameSelectionMode; label: string }[] = [
        { value: "MANUAL", label: "Escolher jogos" },
        { value: "RANDOM", label: "Aleatório" },
    ];

    return (
        <div className={styles.panel}>
            {/* ── Mode toggle ── */}
            <span className={styles.panelTitle}>Modo de Seleção</span>
            <div className={styles.modeRow}>
                {modes.map((m) => (
                    <button
                        key={m.value}
                        type="button"
                        className={`${styles.modeBtn} ${selectionMode === m.value ? styles.modeBtnActive : ""}`}
                        onClick={() => setSelectionMode(m.value)}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {/* ── Game list (only in MANUAL mode) ── */}
            {selectionMode === "MANUAL" && (
                <>
                    <span className={styles.panelTitle}>Minigames</span>
                    <div className={styles.gameList}>
                        {availableGames.length === 0 ? (
                            <GameCard
                                game={{
                                    id: "reaction",
                                    name: "Reação Rápida",
                                    description: "Clique o mais rápido quando o sinal aparecer!",
                                    thumbnailUrl: "",
                                    minPlayers: 2,
                                    maxPlayers: 8,
                                    isActive: true,
                                }}
                                selected={selectedGameIds.includes("reaction")}
                                onToggle={() => toggleGameSelection("reaction")}
                            />
                        ) : (
                            availableGames
                                .filter((g) => g.isActive)
                                .map((g) => (
                                    <GameCard
                                        key={g.id}
                                        game={g}
                                        selected={selectedGameIds.includes(g.id)}
                                        onToggle={() => toggleGameSelection(g.id)}
                                    />
                                ))
                        )}
                    </div>
                </>
            )}

            {/* ── Rounds stepper ── */}
            <div className={styles.roundsRow}>
                <span className={styles.roundsLabel}>Rodadas:</span>
                <div className="stepper" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button
                        type="button"
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            width: "2rem",
                            height: "2rem",
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            color: "var(--text)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                        onClick={() => setTotalRounds(totalRounds - 1)}
                        disabled={totalRounds <= 1}
                    >
                        −
                    </button>
                    <span style={{ fontSize: "1.3rem", fontWeight: 900, minWidth: "2rem", textAlign: "center" }}>
                        {totalRounds}
                    </span>
                    <button
                        type="button"
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            width: "2rem",
                            height: "2rem",
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            color: "var(--text)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                        onClick={() => setTotalRounds(totalRounds + 1)}
                        disabled={totalRounds >= 20}
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
}
