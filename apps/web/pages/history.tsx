import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { MatchSummary } from "@izma/types";
import { useAuthStore } from "@/store/useAuthStore";
import { apiGetMyMatches } from "@/lib/api";
import styles from "@/styles/History.module.css";

const GAME_LABELS: Record<string, string> = {
    reaction: "🎯 Reaction",
    "color-match": "🎨 Color Match",
};

const POSITION_MEDALS = ["🥇", "🥈", "🥉"];
const POSITION_CLASSES = [styles.positionGold, styles.positionSilver, styles.positionBronze];

function formatDate(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return "agora mesmo";
    if (diffMin < 60) return `${diffMin}min atrás`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h atrás`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d atrás`;

    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const PAGE_SIZE = 20;

export default function HistoryPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [matches, setMatches] = useState<MatchSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const fetchMatches = useCallback(async (offset: number) => {
        try {
            const data = await apiGetMyMatches(PAGE_SIZE, offset);
            if (data.length < PAGE_SIZE) setHasMore(false);
            return data;
        } catch {
            return [];
        }
    }, []);

    useEffect(() => {
        if (!user || user.isGuest) {
            setLoading(false);
            return;
        }
        setLoading(true);
        fetchMatches(0).then((data) => {
            setMatches(data);
            setLoading(false);
        });
    }, [user, fetchMatches]);

    async function handleLoadMore() {
        setLoadingMore(true);
        const data = await fetchMatches(matches.length);
        setMatches((prev) => [...prev, ...data]);
        setLoadingMore(false);
    }

    const isGuest = !user || user.isGuest;

    return (
        <>
            <Head>
                <title>IZMA — Histórico</title>
            </Head>

            <div className={styles.page}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.logo} onClick={() => router.push("/")}>
                        ⚡ IZMA
                    </span>
                    <button className={styles.backBtn} onClick={() => router.push("/")} type="button">
                        ← Voltar
                    </button>
                </div>

                <h1 className={styles.title}>📋 Histórico de Partidas</h1>

                {/* Guest message */}
                {isGuest && (
                    <p className={styles.guestMsg}>
                        Faça login para ver seu histórico de partidas.
                    </p>
                )}

                {/* Loading */}
                {loading && !isGuest && (
                    <div className={styles.loading}>
                        <span className="spinner" />
                    </div>
                )}

                {/* Empty state */}
                {!loading && !isGuest && matches.length === 0 && (
                    <p className={styles.empty}>
                        Nenhuma partida encontrada. Jogue para começar seu histórico!
                    </p>
                )}

                {/* Match list */}
                {!loading && matches.length > 0 && (
                    <div className={styles.matchList}>
                        {matches.map((match) => (
                            <div key={match.id} className={styles.matchCard}>
                                {/* Header: games + date */}
                                <div className={styles.matchHeader}>
                                    <div className={styles.matchGames}>
                                        {match.gameIds.map((gid) => (
                                            <span key={gid} className={styles.gameTag}>
                                                {GAME_LABELS[gid] ?? gid}
                                            </span>
                                        ))}
                                    </div>
                                    <span className={styles.matchDate}>
                                        {formatDate(match.playedAt)}
                                    </span>
                                </div>

                                {/* Players */}
                                <div className={styles.playerList}>
                                    {match.players.map((p) => {
                                        const isSelf = p.userId === user?.id;
                                        const posIdx = p.position - 1;
                                        return (
                                            <div
                                                key={p.userId}
                                                className={`${styles.playerRow} ${isSelf ? styles.playerSelf : ""}`}
                                            >
                                                <span className={`${styles.position} ${POSITION_CLASSES[posIdx] ?? ""}`}>
                                                    {POSITION_MEDALS[posIdx] ?? `#${p.position}`}
                                                </span>
                                                <span className={styles.playerName}>
                                                    {p.nickname}
                                                </span>
                                                {p.isMvp && <span className={styles.mvpBadge}>MVP</span>}
                                                <span className={styles.playerScore}>
                                                    {p.score} pts
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Load more */}
                {!loading && hasMore && matches.length > 0 && (
                    <div className={styles.loadMore}>
                        <button
                            className={styles.loadMoreBtn}
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            type="button"
                        >
                            {loadingMore ? "Carregando…" : "Carregar mais"}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
