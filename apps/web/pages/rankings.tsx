import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { RankingPeriod, RankedUser } from "@izma/types";
import { apiGetTopCoins, apiGetTopVictories } from "@/lib/api";
import styles from "@/styles/Rankings.module.css";

type Category = "coins" | "victories";

const PERIODS: { key: RankingPeriod; label: string }[] = [
    { key: "daily", label: "Diário" },
    { key: "weekly", label: "Semanal" },
    { key: "monthly", label: "Mensal" },
    { key: "all", label: "Todos" },
];

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_CLASSES = [styles.gold, styles.silver, styles.bronze];

export default function RankingsPage() {
    const router = useRouter();
    const [category, setCategory] = useState<Category>("coins");
    const [period, setPeriod] = useState<RankingPeriod>("all");
    const [entries, setEntries] = useState<RankedUser[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (category === "coins") {
                const res = await apiGetTopCoins();
                setEntries(res.entries);
            } else {
                const res = await apiGetTopVictories(period);
                setEntries(res.entries);
            }
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [category, period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <>
            <Head>
                <title>IZMA — Rankings</title>
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

                <h1 className={styles.title}>🏆 Rankings</h1>

                {/* Category tabs */}
                <div className={styles.categoryTabs}>
                    <button
                        className={`${styles.catTab} ${category === "coins" ? styles.catTabActive : ""}`}
                        onClick={() => setCategory("coins")}
                        type="button"
                    >
                        🪙 Moedas
                    </button>
                    <button
                        className={`${styles.catTab} ${category === "victories" ? styles.catTabActive : ""}`}
                        onClick={() => setCategory("victories")}
                        type="button"
                    >
                        🏅 Vitórias
                    </button>
                </div>

                {/* Period filter (victories only) */}
                {category === "victories" && (
                    <div className={styles.periodBar}>
                        {PERIODS.map((p) => (
                            <button
                                key={p.key}
                                className={`${styles.periodBtn} ${period === p.key ? styles.periodActive : ""}`}
                                onClick={() => setPeriod(p.key)}
                                type="button"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Board */}
                {loading ? (
                    <div className={styles.loading}>
                        <span className="spinner" />
                    </div>
                ) : entries.length === 0 ? (
                    <p className={styles.empty}>Nenhum resultado encontrado.</p>
                ) : (
                    <div className={styles.board}>
                        {entries.map((entry, i) => {
                            const isPodium = i < 3;
                            const rowClass = isPodium
                                ? `${styles.podiumRow} ${PODIUM_CLASSES[i]}`
                                : styles.row;

                            return (
                                <div key={entry.userId} className={rowClass}>
                                    {isPodium ? (
                                        <span className={styles.medal}>{MEDALS[i]}</span>
                                    ) : (
                                        <span className={styles.rankNum}>{entry.rank}</span>
                                    )}

                                    {entry.avatarUrl ? (
                                        <img
                                            src={entry.avatarUrl}
                                            alt=""
                                            className={styles.avatar}
                                        />
                                    ) : (
                                        <span className={styles.avatarFallback}>
                                            {entry.username[0]?.toUpperCase() ?? "?"}
                                        </span>
                                    )}

                                    <div className={styles.info}>
                                        <span className={styles.username}>{entry.username}</span>
                                    </div>

                                    <span className={styles.value}>
                                        {category === "coins"
                                            ? `🪙 ${entry.value}`
                                            : `${entry.value} ${entry.value === 1 ? "vitória" : "vitórias"}`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
