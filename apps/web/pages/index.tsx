import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useGameStore } from "@/store/useGameStore";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "@/styles/Home.module.css";

type Tab = "create" | "join";

export default function HomePage() {
  const router = useRouter();
  const { createRoom, joinRoom, room, error, clearError, status } = useGameStore();

  const [tab, setTab] = useState<Tab>("create");
  const [nickname, setNickname] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [roomCode, setRoomCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      createRoom(nickname.trim(), maxPlayers);
    } else {
      joinRoom(roomCode.trim().toUpperCase(), nickname.trim());
    }
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
          <div className={styles.logo}>⚡ IZMA</div>
          <p className={styles.tagline}>Minigames multiplayer em tempo real</p>
        </header>

        <main className={styles.main}>
          <div className={styles.tabs}>
            <button className={[styles.tab, tab === "create" ? styles.activeTab : ""].filter(Boolean).join(" ")} onClick={() => setTab("create")} type="button">
              Criar Sala
            </button>
            <button className={[styles.tab, tab === "join" ? styles.activeTab : ""].filter(Boolean).join(" ")} onClick={() => setTab("join")} type="button">
              Entrar com Código
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
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

            {tab === "create" && (
              <div className={styles.field}>
                <span className={styles.label}>Máximo de jogadores</span>
                <div className={styles.stepper}>
                  <button type="button" className={styles.step} onClick={() => setMaxPlayers((n) => Math.max(2, n - 1))} disabled={maxPlayers <= 2}>−</button>
                  <span className={styles.stepValue}>{maxPlayers}</span>
                  <button type="button" className={styles.step} onClick={() => setMaxPlayers((n) => Math.min(8, n + 1))} disabled={maxPlayers >= 8}>+</button>
                </div>
              </div>
            )}

            {tab === "join" && (
              <Input
                id="roomCode"
                label="Código da sala"
                placeholder="Ex: A3F2B1C0"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoComplete="off"
              />
            )}

            {(fieldError ?? error) && (
              <p className={styles.errorMsg} onClick={() => { setFieldError(null); clearError(); }}>
                ⚠ {fieldError ?? error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth disabled={isConnecting}>
              {isConnecting
                ? <><span className="spinner" style={{ marginRight: "0.5rem" }} /> Conectando…</>
                : tab === "create" ? "🚀 Criar Sala" : "🚪 Entrar na Sala"}
            </Button>
          </form>
        </main>

        <footer className={styles.footer}>
          <p>Rápido · Competitivo · Para o campus</p>
        </footer>
      </div>
    </>
  );
}
