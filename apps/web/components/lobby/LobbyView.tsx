import type { Room } from "@izma/types";
import { useGameStore } from "@/store/useGameStore";
import Button from "@/components/ui/Button";
import PlayerList from "@/components/ui/PlayerList";
import RoomChat from "@/components/chat/RoomChat";
import styles from "./LobbyView.module.css";

interface LobbyViewProps {
    room: Room;
}

export default function LobbyView({ room }: LobbyViewProps) {
    const { playerId, setReady, startGame } = useGameStore();

    const me = room.players.find((p) => p.id === playerId);
    const isHost = room.hostId === playerId;
    const allReady = room.players.length >= 2 && room.players.every((p) => p.isHost || p.status === "ready");
    const isReady = me?.status === "ready";

    const shareUrl = typeof window !== "undefined"
        ? `${window.location.origin}/room/${room.id}`
        : "";

    function copyLink() {
        if (shareUrl) navigator.clipboard.writeText(shareUrl);
    }

    return (
        <div className={styles.lobby}>
            <div className={styles.header}>
                <span className={styles.gameTag}>⚡ Reação Rápida</span>
                <div className={styles.roomCode}>
                    <span className={styles.codeLabel}>Código da sala</span>
                    <div className={styles.codeRow}>
                        <span className={styles.code}>{room.id}</span>
                        <button className={styles.copyBtn} onClick={copyLink} title="Copiar link">
                            📋
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.players}>
                <div className={styles.sectionTitle}>
                    <span>Jogadores</span>
                    <span className={styles.count}>{room.players.length}/{room.maxPlayers}</span>
                </div>
                <PlayerList players={room.players} currentPlayerId={playerId} />
            </div>

            <div className={styles.actions}>
                {!isHost && (
                    <Button
                        variant={isReady ? "secondary" : "primary"}
                        fullWidth
                        onClick={() => setReady()}
                    >
                        {isReady ? "✓ Pronto — Clique para cancelar" : "Estou Pronto!"}
                    </Button>
                )}

                {isHost && (
                    <Button
                        variant="primary"
                        fullWidth
                        disabled={!allReady && room.players.length < 2}
                        onClick={() => startGame()}
                    >
                        {room.players.length < 2
                            ? "Aguardando jogadores…"
                            : allReady
                                ? "🚀 Iniciar Partida"
                                : "Iniciar mesmo assim"}
                    </Button>
                )}
            </div>

            <RoomChat />

            <p className={styles.hint}>
                Compartilhe o link com seus amigos para eles entrarem na sala.
            </p>
        </div>
    );
}
