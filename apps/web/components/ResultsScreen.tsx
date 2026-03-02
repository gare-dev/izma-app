import type { Room } from "@izma/types";
import type { GameResults } from "@izma/protocol";
import { useGameStore } from "@/store/useGameStore";
import Button from "@/components/ui/Button";
import styles from "./ResultsScreen.module.css";

interface ResultsScreenProps {
    room: Room;
    results: GameResults;
    onPlayAgain: () => void;
    onLeave: () => void;
}

export default function ResultsScreen({ room, results, onPlayAgain, onLeave }: ResultsScreenProps) {
    const { playerId } = useGameStore();

    const sorted = room.players
        .slice()
        .sort((a, b) => (results.scores[b.id] ?? 0) - (results.scores[a.id] ?? 0));

    const isMvp = results.mvp === playerId;
    const mvpPlayer = results.mvp ? room.players.find((p) => p.id === results.mvp) : null;

    const medals = ["🥇", "🥈", "🥉"];

    return (
        <div className={styles.screen}>
            <div className={styles.header}>
                <div className={styles.trophy}>🏆</div>
                <h2 className={styles.title}>Resultado Final</h2>
                {mvpPlayer && (
                    <p className={styles.mvpBanner}>
                        {isMvp ? "🎉 Você ganhou!" : `${mvpPlayer.nickname} ganhou a partida!`}
                    </p>
                )}
            </div>

            <div className={styles.podium}>
                {sorted.map((p, i) => (
                    <div
                        key={p.id}
                        className={[
                            styles.entry,
                            i === 0 ? styles.first : "",
                            p.id === playerId ? styles.self : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        <span className={styles.medal}>{medals[i] ?? `#${i + 1}`}</span>
                        <div className={styles.entryInfo}>
                            <span className={styles.entryName}>{p.nickname}</span>
                            {p.id === playerId && <span className={styles.youTag}>você</span>}
                        </div>
                        <span className={styles.entryScore}>{results.scores[p.id] ?? 0} pts</span>
                    </div>
                ))}
            </div>

            {results.rounds.length > 0 && (
                <details className={styles.details}>
                    <summary className={styles.summary}>Ver detalhes das rodadas</summary>
                    <div className={styles.rounds}>
                        {results.rounds.map((r) => {
                            const winner = r.winnerId ? room.players.find((p) => p.id === r.winnerId) : null;
                            const falseStarter = r.falseStarterId
                                ? room.players.find((p) => p.id === r.falseStarterId)
                                : null;
                            return (
                                <div key={r.round} className={styles.roundRow}>
                                    <span className={styles.roundNum}>R{r.round}</span>
                                    <span>
                                        {falseStarter
                                            ? `💥 ${falseStarter.nickname} saiu cedo`
                                            : winner
                                                ? `⚡ ${winner.nickname} — ${r.reactionTime}ms`
                                                : "⏱ Sem reação"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </details>
            )}

            <div className={styles.actions}>
                {room.hostId === playerId && (
                    <Button variant="primary" fullWidth onClick={onPlayAgain}>
                        🔄 Jogar Novamente
                    </Button>
                )}
                <Button variant="ghost" fullWidth onClick={onLeave}>
                    Sair da Sala
                </Button>
            </div>
        </div>
    );
}
