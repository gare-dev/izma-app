import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { PublicClanInfo, ClanJoinMode } from "@izma/types";
import { useClanStore } from "@/store/useClanStore";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/Clans.module.css";

const MODE_LABELS: Record<ClanJoinMode, string> = {
    public: "Público",
    private: "Privado",
    approval: "Aprovação",
};

const MODE_CLASS: Record<ClanJoinMode, string> = {
    public: styles.modePublic,
    private: styles.modePrivate,
    approval: styles.modeApproval,
};

export default function ClansPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const { clanList, loading, fetchClanList } = useClanStore();
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchClanList();
    }, [fetchClanList]);

    const handleSearch = useCallback(() => {
        fetchClanList(search);
    }, [search, fetchClanList]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSearch();
    };

    return (
        <>
            <Head>
                <title>IZMA — Clãs</title>
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

                <h1 className={styles.title}>🏰 Clãs</h1>

                {/* Search + Create */}
                <div className={styles.searchBar}>
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Pesquisar clã por nome..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {user && !("isGuest" in user && user.isGuest) && (
                        <button
                            className={styles.createBtn}
                            onClick={() => router.push("/clans/create")}
                            type="button"
                        >
                            + Criar
                        </button>
                    )}
                </div>

                {/* My clan shortcut */}
                {user && !("isGuest" in user && user.isGuest) && (
                    <button
                        className={styles.actionBtn}
                        onClick={() => router.push("/clans/me")}
                        type="button"
                    >
                        Meu Clã
                    </button>
                )}

                {/* Clan list */}
                {loading ? (
                    <div className={styles.loading}>
                        <span className="spinner" />
                    </div>
                ) : clanList.length === 0 ? (
                    <p className={styles.empty}>Nenhum clã encontrado.</p>
                ) : (
                    <div className={styles.clanList}>
                        {clanList.map((clan) => (
                            <div
                                key={clan.id}
                                className={styles.clanCard}
                                onClick={() => router.push(`/clans/${clan.id}`)}
                            >
                                {clan.avatarUrl ? (
                                    <img src={clan.avatarUrl} alt="" className={styles.clanAvatar} />
                                ) : (
                                    <span className={styles.clanAvatarFallback}>
                                        {clan.name[0]?.toUpperCase() ?? "?"}
                                    </span>
                                )}

                                <div className={styles.clanInfo}>
                                    <div className={styles.clanName}>{clan.name}</div>
                                    {clan.bio && <div className={styles.clanBio}>{clan.bio}</div>}
                                </div>

                                <div className={styles.clanMeta}>
                                    <span className={styles.clanMembers}>
                                        👥 {clan.memberCount}
                                    </span>
                                    <span className={`${styles.clanMode} ${MODE_CLASS[clan.joinMode]}`}>
                                        {MODE_LABELS[clan.joinMode]}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
