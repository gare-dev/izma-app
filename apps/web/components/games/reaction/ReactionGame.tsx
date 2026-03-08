import { useEffect, useRef } from "react";
import type { Room, ReactionGameState } from "@izma/types";
import type { GameComponentProps } from "../registry";
import { registerGameComponent } from "../registry";
import styles from "./ReactionGame.module.css";

export default function ReactionGame({ room, gameState: rawState, playerId, onAction }: GameComponentProps) {
    const gameState = rawState as ReactionGameState;
    const hasReactedRef = useRef(false);

    // Reset per round
    useEffect(() => {
        if (gameState.phase === "waiting" || gameState.phase === "countdown") {
            hasReactedRef.current = false;
        }
    }, [gameState.phase, gameState.round]);

    function handleClick() {
        if (hasReactedRef.current) return;
        hasReactedRef.current = true;
        onAction("REACT");
    }

    const me = room.players.find((p) => p.id === playerId);
    const winner = gameState.winner ? room.players.find((p) => p.id === gameState.winner) : null;
    const falseStarter = gameState.falseStarter
        ? room.players.find((p) => p.id === gameState.falseStarter)
        : null;

    const iAmWinner = gameState.winner === playerId;
    const iAmFalseStarter = gameState.falseStarter === playerId;

    // ── Countdown ─────────────────────────────────────────────────────────────
    if (gameState.phase === "countdown") {
        return (
            <div className={styles.center}>
                <div className={styles.bigNumber}>{gameState.countdown}</div>
                <p className={styles.hint}>Prepare-se…</p>
            </div>
        );
    }

    // ── Waiting for signal ────────────────────────────────────────────────────
    if (gameState.phase === "waiting") {
        return (
            <button
                className={`${styles.arena} ${styles.waiting}`}
                onClick={handleClick}
                aria-label="Área de reação"
            >
                <div className={styles.waitText}>Aguarde…</div>
                <p className={styles.subHint}>Não clique ainda!</p>
            </button>
        );
    }

    // ── Signal shown ──────────────────────────────────────────────────────────
    if (gameState.phase === "reacting") {
        return (
            <button
                className={`${styles.arena} ${styles.reacting}`}
                onClick={handleClick}
                aria-label="CLIQUE AGORA"
            >
                <div className={styles.reactText}>AGORA!</div>
                <p className={styles.subHint}>Clique o mais rápido possível!</p>
            </button>
        );
    }

    // ── Round result ──────────────────────────────────────────────────────────
    if (gameState.phase === "round_result") {
        return (
            <div className={styles.center}>
                {falseStarter ? (
                    <div className={styles.resultCard} data-outcome={iAmFalseStarter ? "self-false" : "false"}>
                        <span className={styles.resultIcon}>💥</span>
                        <strong>{iAmFalseStarter ? "Você clicou cedo demais! -1pt" : `${falseStarter.nickname} clicou cedo demais!`}</strong>
                    </div>
                ) : winner ? (
                    <div className={styles.resultCard} data-outcome={iAmWinner ? "win" : "lose"}>
                        <span className={styles.resultIcon}>{iAmWinner ? "🏆" : "😤"}</span>
                        <strong>
                            {iAmWinner
                                ? `Você venceu! ${gameState.lastReactionTime}ms`
                                : `${winner.nickname} venceu em ${gameState.lastReactionTime}ms`}
                        </strong>
                    </div>
                ) : (
                    <div className={styles.resultCard} data-outcome="timeout">
                        <span className={styles.resultIcon}>⏱</span>
                        <strong>Ninguém reagiu a tempo</strong>
                    </div>
                )}

                {/* Mini scoreboard */}
                <div className={styles.miniScore}>
                    {room.players
                        .slice()
                        .sort((a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0))
                        .map((p) => (
                            <div key={p.id} className={[styles.scoreRow, p.id === playerId ? styles.scoreSelf : ""].filter(Boolean).join(" ")}>
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
                <div className={styles.bigText}>⏳ Calculando resultados…</div>
            </div>
        );
    }

    return null;
}

// ── Register this game in the frontend registry ─────────────────────────────
registerGameComponent("reaction", ReactionGame);
