import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useGameStore } from "@/store/useGameStore";
import { useAuthStore } from "@/store/useAuthStore";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AuthModal from "@/components/auth/AuthModal";
import GameSelection from "@/components/games/GameSelection";
import GlobalChat from "@/components/chat/GlobalChat";
import styles from "@/styles/Home.module.css";

type Tab = "create" | "join" | "browse";

export default function HomePage() {
  const router = useRouter();
  const { createRoom, joinRoom, joinRandomRoom, fetchPublicRooms, publicRooms, room, error, clearError, status } = useGameStore();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<Tab>("create");
  const [nickname, setNickname] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roomCode, setRoomCode] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // Always sync nickname from authenticated user
  const isLoggedIn = !!user;
  useEffect(() => {
    if (user) {
      setNickname(user.username);
    }
  }, [user]);

  // Pre-fill room code from ?room= query param (share-link flow)
  useEffect(() => {
    const code = router.query.room as string | undefined;
    if (code) {
      setRoomCode(code.toUpperCase());
      setTab("join");
    }
  }, [router.query]);

  // Navigate once we have a room
  useEffect(() => {
    if (room) {
      void router.push(`/room/${room.id}`);
    }
  }, [room, router]);

  // Show WS errors → stop loading
  useEffect(() => {
    if (error) setLoading(false);
  }, [error]);

  // Fetch public rooms when browse tab is active (poll every 5s)
  useEffect(() => {
    if (tab !== "browse") return;
    fetchPublicRooms();
    const interval = setInterval(fetchPublicRooms, 5000);
    return () => clearInterval(interval);
  }, [tab, fetchPublicRooms]);

  function validate(): boolean {
    setFieldError(null);
    if (!nickname.trim()) { setFieldError("Digite seu apelido."); return false; }
    if (tab === "join" && roomCode.trim().length < 4) { setFieldError("Código inválido."); return false; }
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    clearError();
    if (tab === "create") {
      createRoom(nickname.trim(), maxPlayers, undefined, isPrivate);
    } else if (tab === "join") {
      joinRoom(roomCode.trim().toUpperCase(), nickname.trim());
    }
  }

  function handleJoinRandom() {
    if (!nickname.trim()) { setFieldError("Digite seu apelido."); return; }
    setLoading(true);
    clearError();
    joinRandomRoom(nickname.trim());
  }

  function handleJoinBrowsed(roomId: string) {
    if (!nickname.trim()) { setFieldError("Digite seu apelido."); return; }
    setLoading(true);
    clearError();
    joinRoom(roomId, nickname.trim());
  }

  const isConnecting = loading || status === "connecting";

  return (
    <>
      <Head>
        <title>IZMA — Minigames Multiplayer</title>
        <meta name="description" content="Minigames multiplayer rápidos para o campus." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.page}>
        {/* ── Top bar ── */}
        <nav className={styles.topBar}>
          <button type="button" className={styles.iconBtn} onClick={() => router.push("/rankings")} aria-label="Rankings">
            🏆
          </button>
          <div className={styles.logo}>⚡ IZMA</div>
          <button type="button" className={styles.profileBtn} onClick={() => setAuthOpen(true)} aria-label="Perfil">
            {isLoggedIn ? (
              user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarFallback}>{user.username[0]?.toUpperCase() ?? "?"}</span>
              )
            ) : (
              <span className={styles.avatarFallback}>👤</span>
            )}
          </button>
        </nav>

        {/* ── Welcome section ── */}
        <header className={styles.welcome}>
          {isLoggedIn ? (
            <>
              <span className={styles.greeting}>Olá, <strong>{user.username}</strong></span>
              <span className={styles.coins}>🪙 {user.coins} moedas</span>
            </>
          ) : (
            <div className={styles.guestNickname}>
              <Input
                id="nickname"
                label="Seu apelido"
                placeholder="Ex: Thunderbolt"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                autoComplete="off"
                autoFocus
              />
            </div>
          )}
        </header>

        {/* ── Quick actions ── */}
        <section className={styles.quickActions}>
          <button
            type="button"
            className={`${styles.quickBtn} ${styles.quickCreate}`}
            onClick={() => setTab("create")}
          >
            <span className={styles.quickIcon}>🚀</span>
            <span className={styles.quickLabel}>Criar Sala</span>
          </button>
          <button
            type="button"
            className={`${styles.quickBtn} ${styles.quickJoin}`}
            onClick={() => setTab("join")}
          >
            <span className={styles.quickIcon}>🚪</span>
            <span className={styles.quickLabel}>Entrar</span>
          </button>
          <button
            type="button"
            className={`${styles.quickBtn} ${styles.quickBrowse}`}
            onClick={() => setTab("browse")}
          >
            <span className={styles.quickIcon}>🔍</span>
            <span className={styles.quickLabel}>Salas</span>
          </button>
          <button
            type="button"
            className={`${styles.quickBtn} ${styles.quickRandom}`}
            onClick={handleJoinRandom}
            disabled={isConnecting}
          >
            <span className={styles.quickIcon}>🎲</span>
            <span className={styles.quickLabel}>Aleatória</span>
          </button>
          <button
            type="button"
            className={`${styles.quickBtn} ${styles.quickBrowse}`}
            onClick={() => router.push("/clans")}
          >
            <span className={styles.quickIcon}>🏰</span>
            <span className={styles.quickLabel}>Clãs</span>
          </button>
        </section>

        {/* ── Error banner ── */}
        {(fieldError ?? error) && (
          <p className={styles.errorMsg} onClick={() => { setFieldError(null); clearError(); }}>
            ⚠ {fieldError ?? error}
          </p>
        )}

        {/* ── Main content area ── */}
        <main className={styles.main}>

          {/* ── Create room ── */}
          {tab === "create" && (
            <form className={styles.card} onSubmit={handleSubmit} noValidate>
              <h2 className={styles.cardTitle}>Criar Sala</h2>

              <div className={styles.optionRow}>
                <span className={styles.optionLabel}>Jogadores</span>
                <div className={styles.stepper}>
                  <button type="button" className={styles.step} onClick={() => setMaxPlayers((n) => Math.max(2, n - 1))} disabled={maxPlayers <= 2}>−</button>
                  <span className={styles.stepValue}>{maxPlayers}</span>
                  <button type="button" className={styles.step} onClick={() => setMaxPlayers((n) => Math.min(8, n + 1))} disabled={maxPlayers >= 8}>+</button>
                </div>
              </div>

              <GameSelection />

              <button
                type="button"
                className={`${styles.toggleRow} ${isPrivate ? styles.toggleRowActive : ""}`}
                onClick={() => setIsPrivate((v) => !v)}
              >
                <span className={styles.toggleIcon}>{isPrivate ? "🔒" : "🌐"}</span>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleText}>{isPrivate ? "Sala Privada" : "Sala Pública"}</span>
                  <span className={styles.toggleHint}>{isPrivate ? "Só entra com o link" : "Visível para todos"}</span>
                </div>
              </button>

              <Button type="submit" variant="primary" size="lg" fullWidth disabled={isConnecting}>
                {isConnecting
                  ? <><span className="spinner" style={{ marginRight: "0.5rem" }} /> Conectando…</>
                  : "🚀 Criar Sala"}
              </Button>
            </form>
          )}

          {/* ── Join by code ── */}
          {tab === "join" && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Entrar na Sala</h2>

              <Input
                id="roomCode"
                label="Código da sala"
                placeholder="Ex: A3F2B1C0"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoComplete="off"
                autoFocus
              />

              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isConnecting}
                onClick={() => {
                  const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
                  handleSubmit(fakeEvent);
                }}
              >
                {isConnecting
                  ? <><span className="spinner" style={{ marginRight: "0.5rem" }} /> Conectando…</>
                  : "🚪 Entrar"}
              </Button>
            </div>
          )}

          {/* ── Browse public rooms ── */}
          {tab === "browse" && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Salas Abertas</h2>

              {publicRooms.length === 0 ? (
                <p className={styles.emptyRooms}>Nenhuma sala pública aberta.</p>
              ) : (
                <ul className={styles.roomList}>
                  {publicRooms.map((r) => (
                    <li key={r.id} className={styles.roomItem}>
                      <div className={styles.roomInfo}>
                        <span className={styles.roomHost}>{r.hostNickname}</span>
                        <span className={styles.roomMeta}>👥 {r.playerCount}/{r.maxPlayers}</span>
                      </div>
                      <Button type="button" variant="primary" size="sm" disabled={isConnecting} onClick={() => handleJoinBrowsed(r.id)}>
                        Entrar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </main>

        {/* ── Global Chat ── */}
        <GlobalChat />
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
