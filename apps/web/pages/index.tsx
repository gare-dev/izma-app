import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useGameStore } from "@/store/useGameStore";
import { useAuthStore } from "@/store/useAuthStore";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AuthModal from "@/components/auth/AuthModal";
import GameSelection from "@/components/games/GameSelection";
import styles from "@/styles/Home.module.css";

type Tab = "create" | "join" | "browse";

export default function HomePage() {
  const router = useRouter();
  const { createRoom, joinRoom, joinRandomRoom, fetchPublicRooms, publicRooms, room, error, clearError, status } = useGameStore();
  const { user, checkAuth } = useAuthStore();

  const [tab, setTab] = useState<Tab>("create");
  const [nickname, setNickname] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roomCode, setRoomCode] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // Check auth status from cookie on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.logo}>⚡ IZMA</div>
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.rankingsBtn}
                onClick={() => router.push("/rankings")}
              >
                🏆 Rankings
              </button>
              <button
                className={styles.profileBtn}
                onClick={() => setAuthOpen(true)}
                type="button"
              >
                {isLoggedIn ? (
                  <>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className={styles.profileAvatar} />
                    ) : (
                      <span className={styles.profileAvatar}>
                        {user.username[0]?.toUpperCase() ?? "?"}
                      </span>
                    )}
                    <span className={styles.profileCoins}>🪙 {user.coins}</span>
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </div>
          </div>
          <p className={styles.tagline}>Minigames multiplayer em tempo real</p>
        </header>

        <main className={styles.main}>
          {/* ── Nickname (always visible) ── */}
          <div className={styles.nicknameBar}>
            <Input
              id="nickname"
              label={isLoggedIn ? "Jogando como" : "Seu apelido"}
              placeholder="Ex: Thunderbolt"
              value={nickname}
              onChange={(e) => { if (!isLoggedIn) setNickname(e.target.value); }}
              maxLength={20}
              autoComplete="off"
              autoFocus={!isLoggedIn}
              disabled={isLoggedIn}
              title={isLoggedIn ? "Seu nome de usuário é usado automaticamente" : undefined}
              style={isLoggedIn ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
            />
          </div>

          {/* ── Tabs ── */}
          <div className={styles.tabs}>
            <button className={[styles.tab, tab === "create" ? styles.activeTab : ""].filter(Boolean).join(" ")} onClick={() => setTab("create")} type="button">
              Criar Sala
            </button>
            <button className={[styles.tab, tab === "join" ? styles.activeTab : ""].filter(Boolean).join(" ")} onClick={() => setTab("join")} type="button">
              Entrar
            </button>
            <button className={[styles.tab, tab === "browse" ? styles.activeTab : ""].filter(Boolean).join(" ")} onClick={() => setTab("browse")} type="button">
              Salas Abertas
            </button>
          </div>

          {/* ── Create room ── */}
          {tab === "create" && (
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <span className={styles.label}>Máximo de jogadores</span>
                <div className={styles.stepper}>
                  <button type="button" className={styles.step} onClick={() => setMaxPlayers((n) => Math.max(2, n - 1))} disabled={maxPlayers <= 2}>−</button>
                  <span className={styles.stepValue}>{maxPlayers}</span>
                  <button type="button" className={styles.step} onClick={() => setMaxPlayers((n) => Math.min(8, n + 1))} disabled={maxPlayers >= 8}>+</button>
                </div>
              </div>

              <GameSelection />

              {/* ── Privacy toggle ── */}
              <button
                type="button"
                className={[styles.toggle, isPrivate ? styles.toggleActive : ""].filter(Boolean).join(" ")}
                onClick={() => setIsPrivate((v) => !v)}
              >
                <span className={styles.toggleIcon}>{isPrivate ? "🔒" : "🌐"}</span>
                <span className={styles.toggleText}>
                  {isPrivate ? "Sala Privada" : "Sala Pública"}
                </span>
                <span className={styles.toggleHint}>
                  {isPrivate ? "Só entra com o link" : "Visível para todos"}
                </span>
              </button>

              {(fieldError ?? error) && (
                <p className={styles.errorMsg} onClick={() => { setFieldError(null); clearError(); }}>
                  ⚠ {fieldError ?? error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" fullWidth disabled={isConnecting}>
                {isConnecting
                  ? <><span className="spinner" style={{ marginRight: "0.5rem" }} /> Conectando…</>
                  : "🚀 Criar Sala"}
              </Button>
            </form>
          )}

          {/* ── Join by code / random ── */}
          {tab === "join" && (
            <div className={styles.form}>
              <Input
                id="roomCode"
                label="Código da sala"
                placeholder="Ex: A3F2B1C0"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoComplete="off"
              />

              {(fieldError ?? error) && (
                <p className={styles.errorMsg} onClick={() => { setFieldError(null); clearError(); }}>
                  ⚠ {fieldError ?? error}
                </p>
              )}

              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isConnecting}
                onClick={(e) => {
                  // wrap in a form submit equivalent
                  const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
                  handleSubmit(fakeEvent);
                }}
              >
                {isConnecting
                  ? <><span className="spinner" style={{ marginRight: "0.5rem" }} /> Conectando…</>
                  : "🚪 Entrar na Sala"}
              </Button>

              <div className={styles.divider}>
                <span>ou</span>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                disabled={isConnecting}
                onClick={handleJoinRandom}
              >
                🎲 Sala Aleatória
              </Button>
            </div>
          )}

          {/* ── Browse public rooms ── */}
          {tab === "browse" && (
            <div className={styles.form}>
              {(fieldError ?? error) && (
                <p className={styles.errorMsg} onClick={() => { setFieldError(null); clearError(); }}>
                  ⚠ {fieldError ?? error}
                </p>
              )}

              {publicRooms.length === 0 ? (
                <p className={styles.emptyRooms}>Nenhuma sala pública aberta no momento.</p>
              ) : (
                <ul className={styles.roomList}>
                  {publicRooms.map((r) => (
                    <li key={r.id} className={styles.roomCard}>
                      <div className={styles.roomInfo}>
                        <span className={styles.roomHost}>{r.hostNickname}</span>
                        <span className={styles.roomPlayers}>
                          👥 {r.playerCount}/{r.maxPlayers}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isConnecting}
                        onClick={() => handleJoinBrowsed(r.id)}
                      >
                        Entrar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          <p>Rápido · Competitivo · Para o campus</p>
        </footer>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
