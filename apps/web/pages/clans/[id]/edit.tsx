import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { ClanJoinMode } from "@izma/types";
import { useClanStore } from "@/store/useClanStore";
import { useAuthStore } from "@/store/useAuthStore";
import styles from "@/styles/Clans.module.css";

export default function EditClanPage() {
    const router = useRouter();
    const { id } = router.query;
    const user = useAuthStore((s) => s.user);
    const { myClan, fetchClanDetail, updateClan, uploadAvatar, loading, error, clearError } =
        useClanStore();

    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [joinMode, setJoinMode] = useState<ClanJoinMode>("public");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (id && typeof id === "string") {
            fetchClanDetail(id);
        }
    }, [id]);

    useEffect(() => {
        if (myClan) {
            setName(myClan.name);
            setBio(myClan.bio ?? "");
            setJoinMode(myClan.joinMode);
        }
    }, [myClan]);

    const isOwner =
        user && myClan && !("isGuest" in user && user.isGuest) && myClan.ownerId === user.id;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setSaved(false);

        if (!myClan) return;

        const ok = await updateClan(myClan.id, {
            name,
            bio: bio || undefined,
            joinMode,
        });

        if (ok && avatarFile) {
            await uploadAvatar(myClan.id, avatarFile);
        }

        if (ok) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    if (!isOwner && !loading && myClan) {
        return (
            <div className={styles.page}>
                <Head><title>IZMA — Editar Clã</title></Head>
                <p className={styles.empty}>Apenas o dono pode editar o clã.</p>
                <button className={styles.backBtn} onClick={() => router.back()} type="button">
                    ← Voltar
                </button>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>IZMA — Editar Clã</title>
            </Head>

            <div className={styles.page}>
                <div className={styles.header}>
                    <span className={styles.logo} onClick={() => router.push("/")}>
                        ⚡ IZMA
                    </span>
                    <button
                        className={styles.backBtn}
                        onClick={() => router.push(`/clans/${id}`)}
                        type="button"
                    >
                        ← Voltar
                    </button>
                </div>

                <h1 className={styles.title}>✏️ Editar Clã</h1>

                {loading && !myClan && <p className={styles.empty}>Carregando...</p>}

                {myClan && (
                    <form className={styles.form} onSubmit={handleSubmit}>
                        <div className={styles.field}>
                            <label className={styles.label}>Avatar do clã</label>
                            <input
                                type="file"
                                accept="image/*"
                                className={styles.input}
                                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Nome do clã</label>
                            <input
                                className={styles.input}
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={30}
                                required
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Bio</label>
                            <textarea
                                className={styles.textarea}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
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
                                <option value="public">Público</option>
                                <option value="approval">Aprovação</option>
                                <option value="private">Privado</option>
                            </select>
                        </div>

                        {error && <div className={styles.errorMsg}>{error}</div>}
                        {saved && <div className={styles.successMsg}>Salvo com sucesso!</div>}

                        <button
                            className={styles.submitBtn}
                            type="submit"
                            disabled={loading || !name.trim()}
                        >
                            {loading ? "Salvando..." : "Salvar alterações"}
                        </button>
                    </form>
                )}
            </div>
        </>
    );
}
