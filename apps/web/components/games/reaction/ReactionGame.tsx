import { useEffect, useRef } from "react";
import type { Room, ReactionGameState } from "@izma/types";
import { useGameStore } from "@/store/useGameStore";
import styles from "./ReactionGame.module.css";

interface ReactionGameProps {
    room: Room;
    gameState: ReactionGameState;
}

export default function ReactionGame({ room, gameState }: ReactionGameProps) {
    const { playerId, react } = useGameStore();
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
        react();
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
                <div className={styles.roundBadge}>Rodada {gameState.round}/{gameState.totalRounds}</div>
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
                <div className={styles.roundBadge}>Rodada {gameState.round}/{gameState.totalRounds}</div>
                <div className={styles.reactText}>AGORA!</div>
                <p className={styles.subHint}>Clique o mais rápido possível!</p>
            </button>
        );
    }

    // ── Round result ──────────────────────────────────────────────────────────
    if (gameState.phase === "round_result") {
        return (
            <div className={styles.center}>
                <div className={styles.roundBadge} style={{ marginBottom: "1rem" }}>
                    Rodada {gameState.round}/{gameState.totalRounds}
                </div>

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

// ── Lobby scores shown during countdown ─────────────────────────────────────
export function GameScoreBar({ room, gameState }: { room: Room; gameState: ReactionGameState }) {
    return (
        <div className={styles.scoreBar}>
            {room.players
                .slice()
                .sort((a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0))
                .map((p, i) => (
                    <div key={p.id} className={styles.scoreChip}>
                        <span className={styles.rank}>{i + 1}</span>
                        <span className={styles.chipName}>{p.nickname}</span>
                        <span className={styles.chipScore}>{gameState.scores[p.id] ?? 0}</span>
                    </div>
                ))}
        </div>
    );
}
