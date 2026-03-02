import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useGameStore } from "@/store/useGameStore";
import LobbyView from "@/components/lobby/LobbyView";
import ReactionGame, { GameScoreBar } from "@/components/games/reaction/ReactionGame";
import ResultsScreen from "@/components/ResultsScreen";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "@/styles/Room.module.css";

export const dynamic = "force-dynamic";



export default function RoomPage() {
    const router = useRouter();
    const { id: roomId } = router.query as { id: string };

    const {
        room,
        gameState,
        gameResults,
        playerId,
        status,
        error,
        clearError,
        joinRoom,
        disconnect,
        resetGame,
    } = useGameStore();

    // If user arrives via share link without being connected
    const [joinNickname, setJoinNickname] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    const isConnected = status === "connected";
    const hasJoined = !!room && !!playerId;

    // Kick to home if connection is lost
    useEffect(() => {
        if (status === "disconnected" && hasJoined) {
            void router.push("/");
        }
    }, [status, hasJoined, router]);

    // Show server errors
    useEffect(() => {
        if (error) setJoining(false);
    }, [error]);

    function handleJoin(e: React.FormEvent) {
        e.preventDefault();
        if (!joinNickname.trim()) { setJoinError("Digite seu apelido."); return; }
        if (!roomId) return;
        setJoinError(null);
        setJoining(true);
        clearError();
        joinRoom(roomId, joinNickname.trim());
    }

    function handleLeave() {
        disconnect();
        void router.push("/");
    }

    function handlePlayAgain() {
        resetGame();
    }

    // ── Not yet joined ────────────────────────────────────────────────────────
    if (!hasJoined) {
        return (
            <>
                <Head><title>IZMA — Entrar na Sala</title></Head>
                <div className={styles.page}>
                    <div className={styles.joinCard}>
                        <div className={styles.joinLogo}>⚡ IZMA</div>
                        <h2 className={styles.joinTitle}>Entrar na Sala</h2>
                        {roomId && <p className={styles.joinCode}>Código: <strong>{roomId}</strong></p>}
                        <form onSubmit={handleJoin} className={styles.joinForm} noValidate>
                            <Input
                                id="joinNickname"
                                label="Seu apelido"
                                placeholder="Ex: Thunderbolt"
                                value={joinNickname}
                                onChange={(e) => setJoinNickname(e.target.value)}
                                maxLength={20}
                                autoFocus
                                error={joinError ?? (error ?? undefined)}
                            />
                            <Button type="submit" variant="primary" fullWidth disabled={joining || status === "connecting"}>
                                {joining ? "Conectando…" : "🚪 Entrar"}
                            </Button>
                        </form>
                    </div>
                </div>
            </>
        );
    }

    // ── Results ───────────────────────────────────────────────────────────────
    if (gameResults) {
        return (
            <>
                <Head><title>IZMA — Resultado</title></Head>
                <div className={styles.page}>
                    <ResultsScreen
                        room={room}
                        results={gameResults}
                        onPlayAgain={handlePlayAgain}
                        onLeave={handleLeave}
                    />
                </div>
            </>
        );
    }

    // ── Playing ───────────────────────────────────────────────────────────────
    if (room.state === "playing" && gameState) {
        return (
            <>
                <Head><title>IZMA — Em Jogo</title></Head>
                <div className={styles.page}>
                    <div className={styles.gameHeader}>
                        <GameScoreBar room={room} gameState={gameState} />
                        <span className={styles.roundIndicator}>
                            Rodada {gameState.round}/{gameState.totalRounds}
                        </span>
                    </div>
                    <div className={styles.gameArea}>
                        <ReactionGame room={room} gameState={gameState} />
                    </div>
                </div>
            </>
        );
    }

    // ── Lobby ─────────────────────────────────────────────────────────────────
    return (
        <>
            <Head><title>IZMA — Sala {room.id}</title></Head>
            <div className={styles.page}>
                <nav className={styles.nav}>
                    <span className={styles.navLogo}>⚡ IZMA</span>
                    <Button variant="ghost" size="sm" onClick={handleLeave}>Sair</Button>
                </nav>

                {error && (
                    <div className={styles.errorBanner} onClick={clearError}>
                        ⚠ {error}
                    </div>
                )}

                <LobbyView room={room} />
            </div>
        </>
    );
}

export async function getServerSideProps() {
    return { props: {} };
}