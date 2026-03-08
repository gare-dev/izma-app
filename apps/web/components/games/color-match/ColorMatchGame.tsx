import { useRef } from "react";
import type { ColorMatchGameState } from "@izma/types";
import type { GameComponentProps } from "../registry";
import { registerGameComponent } from "../registry";
import styles from "./ColorMatchGame.module.css";

export default function ColorMatchGame({ room, gameState: rawState, playerId, onAction }: GameComponentProps) {
    const gameState = rawState as ColorMatchGameState;
    const hasPickedRef = useRef(false);
    const lastRoundRef = useRef(0);

    // Reset pick flag when a new round starts
    if (gameState.round !== lastRoundRef.current) {
        lastRoundRef.current = gameState.round;
        hasPickedRef.current = false;
    }

    function handlePick(colorName: string) {
        if (hasPickedRef.current) return;
        hasPickedRef.current = true;
        onAction("PICK", { color: colorName });
    }

    const winner = gameState.winner ? room.players.find((p) => p.id === gameState.winner) : null;
    const iAmWinner = gameState.winner === playerId;

    // ── Countdown ─────────────────────────────────────────────────────────────
    if (gameState.phase === "countdown") {
        return (
            <div className={styles.center}>
                <div className={styles.bigNumber}>{gameState.countdown}</div>
                <p className={styles.hint}>Prepare-se…</p>
            </div>
        );
    }

    // ── Showing color / picking ───────────────────────────────────────────────
    if (gameState.phase === "showing") {
        return (
            <div className={styles.colorArena}>
                <p className={styles.instruction}>Qual é a palavra escrita?</p>

                <div
                    className={styles.colorWord}
                    style={{ color: gameState.displayColor ?? "#fff" }}
                >
                    {gameState.displayWord}
                </div>

                <div className={styles.optionsGrid}>
                    {gameState.options.map((opt) => (
                        <button
                            key={opt}
                            className={`${styles.optionBtn} ${hasPickedRef.current ? styles.picked : ""}`}
                            onClick={() => handlePick(opt)}
                            disabled={hasPickedRef.current}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ── Round result ──────────────────────────────────────────────────────────
    if (gameState.phase === "round_result") {
        return (
            <div className={styles.center}>
                <p className={styles.hint}>
                    Resposta: <strong>{gameState.correctAnswer}</strong>
                </p>

                {winner ? (
                    <div className={styles.resultCard} data-outcome={iAmWinner ? "win" : "lose"}>
                        <span className={styles.resultIcon}>{iAmWinner ? "🏆" : "😤"}</span>
                        <strong>
                            {iAmWinner
                                ? "Você acertou primeiro!"
                                : `${winner.nickname} acertou primeiro!`}
                        </strong>
                    </div>
                ) : (
                    <div className={styles.resultCard} data-outcome="timeout">
                        <span className={styles.resultIcon}>⏱</span>
                        <strong>Ninguém acertou a tempo</strong>
                    </div>
                )}

                <div className={styles.miniScore}>
                    {room.players
                        .slice()
                        .sort((a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0))
                        .map((p) => (
                            <div
                                key={p.id}
                                className={[styles.scoreRow, p.id === playerId ? styles.scoreSelf : ""].filter(Boolean).join(" ")}
                            >
                                <span>{p.nickname}</span>
                                <span>{gameState.scores[p.id] ?? 0} pts</span>
                            </div>
                        ))}
                </div>

                <p className={styles.hint}>Próxima rodada em breve…</p>
            </div>
        );
    }

    // ── Game over ─────────────────────────────────────────────────────────────
    if (gameState.phase === "game_over") {
        return (
            <div className={styles.center}>
                <p className={styles.hint}>⏳ Calculando resultados…</p>
            </div>
        );
    }

    return null;
}

// ── Register ────────────────────────────────────────────────────────────────
registerGameComponent("color-match", ColorMatchGame);
