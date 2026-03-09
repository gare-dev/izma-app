import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useClanStore } from "@/store/useClanStore";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/Clans.module.css";

export default function InvitePage() {
    const router = useRouter();
    const { code } = router.query;
    const user = useAuthStore((s) => s.user);
    const { joinByInvite, loading, error, clearError } = useClanStore();
    const [joined, setJoined] = useState(false);
    const [clanId, setClanId] = useState<string | null>(null);

    const noUser = !user || ("isGuest" in user && user.isGuest);

    useEffect(() => {
        clearError();
    }, [code]);

    const handleJoin = async () => {
        if (!code || typeof code !== "string") return;
        clearError();

        const clan = await joinByInvite(code);
        if (clan) {
            setJoined(true);
            setClanId(clan.id);
            setTimeout(() => router.push(`/clans/${clan.id}`), 1500);
        }
    };

    return (
        <>
            <Head>
                <title>IZMA — Convite de Clã</title>
            </Head>

            <div className={styles.page}>
                <div className={styles.header}>
                    <span className={styles.logo} onClick={() => router.push("/")}>
                        ⚡ IZMA
                    </span>
                    <button className={styles.backBtn} onClick={() => router.push("/clans")} type="button">
                        ← Voltar
                    </button>
                </div>

                <h1 className={styles.title}>📩 Convite de Clã</h1>

                {noUser && <p className={styles.empty}>Faça login para aceitar o convite.</p>}

                {!noUser && !joined && (
                    <div style={{ textAlign: "center", marginTop: "2rem" }}>
                        <p style={{ marginBottom: "1rem", color: "var(--text-secondary)" }}>
                            Você foi convidado para entrar em um clã!
                        </p>
                        <button
                            className={styles.actionBtn}
                            onClick={handleJoin}
                            disabled={loading}
                            type="button"
                        >
                            {loading ? "Entrando..." : "Aceitar convite"}
                        </button>
                        {error && <div className={styles.errorMsg} style={{ marginTop: "1rem" }}>{error}</div>}
                    </div>
                )}

                {joined && (
                    <div style={{ textAlign: "center", marginTop: "2rem" }}>
                        <p style={{ color: "var(--success)", fontSize: "1.2rem" }}>
                            ✅ Você entrou no clã!
                        </p>
                        <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                            Redirecionando...
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
