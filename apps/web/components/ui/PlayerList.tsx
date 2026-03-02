import type { Player } from "@izma/types";
import styles from "./PlayerList.module.css";

interface PlayerListProps {
    players: Player[];
    currentPlayerId: string | null;
}

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
    return (
        <ul className={styles.list}>
            {players.map((p) => (
                <li key={p.id} className={[styles.item, p.id === currentPlayerId ? styles.self : ""].filter(Boolean).join(" ")}>
                    <span className={styles.avatar}>{p.nickname[0]?.toUpperCase()}</span>
                    <div className={styles.info}>
                        <span className={styles.name}>
                            {p.nickname}
                            {p.id === currentPlayerId && <span className={styles.you}> (você)</span>}
                        </span>
                        {p.score > 0 && (
                            <span className={styles.score}>{p.score} pt{p.score !== 1 ? "s" : ""}</span>
                        )}
                    </div>
                    <span className={[styles.badge, styles[p.status]].filter(Boolean).join(" ")}>
                        {p.isHost ? "👑 Host" : p.status === "ready" ? "✓ Pronto" : "Aguardando"}
                    </span>
                </li>
            ))}
        </ul>
    );
}
