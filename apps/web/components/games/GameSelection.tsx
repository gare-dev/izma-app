import { useEffect } from "react";
import type { Game, GameSelectionMode } from "@izma/types";
import { useGameStore } from "@/store/useGameStore";
import styles from "./GameSelection.module.css";

/** Icons for known games — extend as new games are added */
const GAME_ICONS: Record<string, string> = {
    reaction: "⚡",
    "color-match": "🎨",
};

// ─── Single game card ──────────────────────────────────────────────────────

interface GameCardProps {
    game: Game;
    selected: boolean;
    onToggle: () => void;
    disabled?: boolean;
    rounds?: number;
    onRoundsChange?: (n: number) => void;
}

function GameCard({ game, selected, onToggle, disabled, rounds, onRoundsChange }: GameCardProps) {
    return (
        <div
            className={`${styles.card} ${selected ? styles.selected : ""}`}
            role="checkbox"
            aria-checked={selected}
        >
            <div className={styles.cardMain} onClick={disabled ? undefined : onToggle}>
                <div className={styles.thumb}>{GAME_ICONS[game.id] ?? "🎮"}</div>
                <div className={styles.info}>
                    <span className={styles.name}>{game.name}</span>
                    <span className={styles.desc}>{game.description}</span>
                </div>
                <div className={`${styles.check} ${selected ? styles.checkSelected : ""}`}>
                    {selected ? "✓" : ""}
                </div>
            </div>
            {selected && rounds != null && onRoundsChange && (
                <RoundsStepper
                    label="Rodadas:"
                    value={rounds}
                    onChange={onRoundsChange}
                />
            )}
        </div>
    );
}

// ─── Full Game Selection Panel ─────────────────────────────────────────────

export default function GameSelection() {
    const {
        availableGames,
        selectedGameIds,
        totalRounds,
        roundsPerGame,
        selectionMode,
        fetchGames,
        setSelectionMode,
        setTotalRounds,
        setGameRounds,
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

    const gameList = availableGames.length > 0
        ? availableGames.filter((g) => g.isActive)
        : [{
            id: "reaction",
            name: "Reação Rápida",
            description: "Clique o mais rápido quando o sinal aparecer!",
            thumbnailUrl: "",
            minPlayers: 2,
            maxPlayers: 8,
            isActive: true,
        }];

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
                        {gameList.map((g) => (
                            <GameCard
                                key={g.id}
                                game={g}
                                selected={selectedGameIds.includes(g.id)}
                                onToggle={() => toggleGameSelection(g.id)}
                                rounds={roundsPerGame[g.id] ?? 3}
                                onRoundsChange={(n) => setGameRounds(g.id, n)}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* ── Global rounds stepper (only in RANDOM mode) ── */}
            {selectionMode === "RANDOM" && (
                <RoundsStepper
                    label="Rodadas:"
                    value={totalRounds}
                    onChange={setTotalRounds}
                />
            )}
        </div>
    );
}

// ─── Reusable Rounds Stepper ───────────────────────────────────────────────

function RoundsStepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
    const btnStyle: React.CSSProperties = {
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
    };

    return (
        <div className={styles.roundsRow}>
            <span className={styles.roundsLabel}>{label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button type="button" style={btnStyle} onClick={() => onChange(value - 1)} disabled={value <= 1}>−</button>
                <span style={{ fontSize: "1.3rem", fontWeight: 900, minWidth: "2rem", textAlign: "center" }}>{value}</span>
                <button type="button" style={btnStyle} onClick={() => onChange(value + 1)} disabled={value >= 20}>+</button>
            </div>
        </div>
    );
}
