import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { ClanJoinMode } from "@izma/types";
import { useClanStore } from "@/store/useClanStore";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/Clans.module.css";

export default function CreateClanPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const { createClan, loading, error, clearError } = useClanStore();

    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [joinMode, setJoinMode] = useState<ClanJoinMode>("public");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        const clan = await createClan({ name, bio: bio || undefined, joinMode });
        if (clan) {
            router.push(`/clans/${clan.id}`);
        }
    };

    if (!user || ("isGuest" in user && user.isGuest)) {
        return (
            <div className={styles.page}>
                <Head><title>IZMA — Criar Clã</title></Head>
                <p className={styles.empty}>Faça login para criar um clã.</p>
                <button className={styles.backBtn} onClick={() => router.push("/clans")} type="button">
                    ← Voltar
                </button>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>IZMA — Criar Clã</title>
            </Head>

            <div className={styles.page}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.logo} onClick={() => router.push("/")}>
                        ⚡ IZMA
                    </span>
                    <button className={styles.backBtn} onClick={() => router.push("/clans")} type="button">
                        ← Voltar
                    </button>
                </div>

                <h1 className={styles.title}>🏰 Criar Clã</h1>

                <div className={styles.costNote}>
                    Custo: <span className={styles.costValue}>🪙 50 moedas</span>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.field}>
                        <label className={styles.label}>Nome do clã</label>
                        <input
                            className={styles.input}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nome único do clã"
                            maxLength={30}
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Bio (opcional)</label>
                        <textarea
                            className={styles.textarea}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Descrição do clã..."
                            maxLength={500}
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Modo de entrada</label>
                        <select
                            className={styles.select}
                            value={joinMode}
                            onChange={(e) => setJoinMode(e.target.value as ClanJoinMode)}
                        >
                            <option value="public">Público — qualquer um pode entrar</option>
                            <option value="approval">Aprovação — dono aceita pedidos</option>
                            <option value="private">Privado — apenas por convite</option>
                        </select>
                    </div>

                    {error && <div className={styles.errorMsg}>{error}</div>}

                    <button
                        className={styles.submitBtn}
                        type="submit"
                        disabled={loading || !name.trim()}
                    >
                        {loading ? "Criando..." : "Criar Clã (50 🪙)"}
                    </button>
                </form>
            </div>
        </>
    );
}
