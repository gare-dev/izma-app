import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useGameStore } from "@/store/useGameStore";
import { useAuthStore } from "@/store/useAuthStore";
import LobbyView from "@/components/lobby/LobbyView";
import ScoreBar from "@/components/games/ScoreBar";
import { getGameComponent } from "@/components/games/registry";
// Register all game components (side-effect imports)
import "@/components/games/reaction/ReactionGame";
import "@/components/games/color-match/ColorMatchGame";
import ResultsScreen from "@/components/ResultsScreen";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "@/styles/Room.module.css";



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
        lastCoinUpdate,
        gameOrder,
        sendAction,
        tryReconnect,
    } = useGameStore();

    const { user, checkAuth } = useAuthStore();
    const isLoggedIn = !!user;

    // Check auth on mount
    useEffect(() => { checkAuth(); }, [checkAuth]);

    // If user arrives via share link without being connected
    const [joinNickname, setJoinNickname] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    // Sync nickname from logged-in user
    useEffect(() => {
        if (user) setJoinNickname(user.username);
    }, [user]);

    const isConnected = status === "connected";
    const hasJoined = !!room && !!playerId;

    // Auto-reconnect on page load (e.g. after refresh / connection loss)
    const [reconnectPending, setReconnectPending] = useState(false);
    useEffect(() => {
        if (!hasJoined && status === "idle") {
            setReconnectPending(true);
            tryReconnect();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Resolve reconnect: success (hasJoined) or timeout fallback
    useEffect(() => {
        if (!reconnectPending) return;
        if (hasJoined) { setReconnectPending(false); return; }
        const timer = setTimeout(() => setReconnectPending(false), 1500);
        return () => clearTimeout(timer);
    }, [reconnectPending, hasJoined]);

    // Auto-join when logged in and not yet joined (share-link flow)
    // Waits for reconnect attempt to resolve so we don't send both RECONNECT and JOIN_ROOM
    const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
    useEffect(() => {
        if (reconnectPending) return;
        // If already joined (e.g. redirected from home after createRoom), mark as
        // attempted so we never re-fire after a disconnect/leave.
        if (hasJoined) {
            if (!autoJoinAttempted) setAutoJoinAttempted(true);
            return;
        }
        if (isLoggedIn && roomId && !autoJoinAttempted && (status === "idle" || status === "connected")) {
            setAutoJoinAttempted(true);
            setJoining(true);
            clearError();
            joinRoom(roomId, user!.username);
        }
    }, [reconnectPending, isLoggedIn, roomId, hasJoined, autoJoinAttempted, status, joinRoom, clearError, user]);

    // Kick to home if connection is lost — but try reconnecting first
    useEffect(() => {
        if (status === "disconnected" && hasJoined) {
            // Clear stale state, attempt reconnect
            useGameStore.setState({
                room: null, playerId: null, gameState: null,
                gameResults: null, gameOrder: [], lastCoinUpdate: null, status: "idle",
            });
            tryReconnect();
            // If no room restored within 3 s, redirect home
            const timer = setTimeout(() => {
                if (!useGameStore.getState().room) void router.push("/");
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [status, hasJoined, router, tryReconnect]);

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
        // Logged-in users auto-join; show loading or error
        if (isLoggedIn) {
            return (
                <>
                    <Head><title>IZMA — Entrar na Sala</title></Head>
                    <div className={styles.page}>
                        <div className={styles.joinCard}>
                            <div className={styles.joinLogo}>⚡ IZMA</div>
                            {error ? (
                                <>
                                    <p className={styles.joinCode} style={{ color: "var(--accent)" }}>⚠ {error}</p>
                                    <Button type="button" variant="secondary" fullWidth onClick={() => router.push("/")}>
                                        Voltar
                                    </Button>
                                </>
                            ) : (
                                <p className={styles.joinCode}>Entrando como <strong>{user!.username}</strong>…</p>
                            )}
                        </div>
                    </div>
                </>
            );
        }

        // Guest: show nickname form
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
                    {lastCoinUpdate && (
                        <div className={styles.coinToast}>
                            🪙 +{lastCoinUpdate.delta} moedas ({lastCoinUpdate.reason === "VICTORY" ? "vitória" : "participação"})
                        </div>
                    )}
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
        const GameComponent = getGameComponent(gameState.gameId);

        return (
            <>
                <Head><title>IZMA — Em Jogo</title></Head>
                <div className={styles.page}>
                    <div className={styles.gameHeader}>
                        <ScoreBar room={room} gameState={gameState} currentPlayerId={playerId} />
                    </div>
                    <div className={styles.gameArea}>
                        {GameComponent ? (
                            <GameComponent
                                room={room}
                                gameState={gameState}
                                playerId={playerId}
                                onAction={sendAction}
                            />
                        ) : (
                            <div style={{ textAlign: "center", padding: "2rem" }}>
                                <p>Jogo &quot;{gameState.gameId}&quot; não encontrado no cliente.</p>
                            </div>
                        )}
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