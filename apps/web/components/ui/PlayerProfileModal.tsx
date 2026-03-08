import type { Player } from "@izma/types";
import styles from "./PlayerProfileModal.module.css";

interface PlayerProfileModalProps {
    player: Player;
    onClose: () => void;
}

export default function PlayerProfileModal({ player, onClose }: PlayerProfileModalProps) {
    const statusLabel =
        player.isHost ? "👑 Host" :
            player.status === "ready" ? "✓ Pronto" :
                player.status === "playing" ? "Jogando" :
                    "Aguardando";

    const statusClass =
        player.isHost ? styles.host :
            player.status === "ready" ? styles.ready :
                player.status === "playing" ? styles.playing :
                    "";

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>✕</button>

                {/* Avatar */}
                {player.avatarUrl ? (
                    <img className={styles.avatarImg} src={player.avatarUrl} alt={player.nickname} />
                ) : (
                    <span className={styles.avatar}>
                        {player.nickname[0]?.toUpperCase()}
                    </span>
                )}

                {/* Name */}
                <span className={styles.nickname}>{player.nickname}</span>

                {/* Guest badge */}
                {!player.userId && <span className={styles.guestTag}>Convidado</span>}

                {/* Bio */}
                {player.bio ? (
                    <p className={styles.bio}>{player.bio}</p>
                ) : (
                    <p className={`${styles.bio} ${styles.noBio}`}>Sem bio</p>
                )}

                {/* Stats */}
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span className={`${styles.statValue} ${styles.score}`}>{player.score}</span>
                        <span className={styles.statLabel}>Pontos</span>
                    </div>
                </div>

                {/* Status badge */}
                <div className={styles.badges}>
                    <span className={`${styles.badge} ${statusClass}`}>{statusLabel}</span>
                </div>
            </div>
        </div>
    );
}
