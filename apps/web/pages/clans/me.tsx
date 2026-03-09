import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useClanStore } from "@/store/useClanStore";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/Clans.module.css";

export default function MyClanPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const { myClan, fetchMyClan, loading } = useClanStore();

    useEffect(() => {
        if (user && !("isGuest" in user && user.isGuest)) {
            fetchMyClan();
        }
    }, [user]);

    useEffect(() => {
        if (!loading && myClan) {
            router.replace(`/clans/${myClan.id}`);
        }
    }, [loading, myClan]);

    const noUser = !user || ("isGuest" in user && user.isGuest);

    return (
        <>
            <Head>
                <title>IZMA — Meu Clã</title>
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

                {noUser && <p className={styles.empty}>Faça login para ver seu clã.</p>}

                {!noUser && loading && <p className={styles.empty}>Carregando...</p>}

                {!noUser && !loading && !myClan && (
                    <div className={styles.empty}>
                        <p>Você não faz parte de nenhum clã.</p>
                        <button
                            className={styles.actionBtn}
                            onClick={() => router.push("/clans")}
                            type="button"
                        >
                            Explorar clãs
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
