import { useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "./AuthModal.module.css";

type AuthTab = "login" | "register" | "guest";

interface AuthModalProps {
    open: boolean;
    onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
    const {
        user, loading, error,
        login, register, loginAsGuest, logout,
        updateProfile, uploadAvatar,
        clearError,
    } = useAuthStore();

    const [tab, setTab] = useState<AuthTab>("login");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [guestName, setGuestName] = useState("");
    const [fieldError, setFieldError] = useState<string | null>(null);

    // ── Profile edit state ──────────────────────────────────────────────
    const [editName, setEditName] = useState("");
    const [editBio, setEditBio] = useState("");
    const [editing, setEditing] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = useCallback(() => {
        setFieldError(null);
        clearError();
        setSuccessMsg(null);
    }, [clearError]);

    function switchTab(t: AuthTab) {
        setTab(t);
        reset();
    }

    function startEditing() {
        if (!user) return;
        setEditName(user.username);
        setEditBio(user.bio ?? "");
        setEditing(true);
        reset();
    }

    async function saveProfile() {
        reset();
        const trimmedName = editName.trim();
        if (trimmedName.length < 3) {
            setFieldError("Username deve ter no mínimo 3 caracteres.");
            return;
        }
        const patch: { username?: string; bio?: string } = {};
        if (trimmedName !== user?.username) patch.username = trimmedName;
        if (editBio.trim() !== (user?.bio ?? "")) patch.bio = editBio.trim();

        if (Object.keys(patch).length === 0) {
            setEditing(false);
            return;
        }

        await updateProfile(patch);
        setEditing(false);
        setSuccessMsg("Perfil atualizado!");
        setTimeout(() => setSuccessMsg(null), 2500);
    }

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        reset();
        await uploadAvatar(file);
        setSuccessMsg("Avatar atualizado!");
        setTimeout(() => setSuccessMsg(null), 2500);
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        reset();
        if (!username.trim() || !password.trim()) {
            setFieldError("Preencha todos os campos.");
            return;
        }
        await login({ username: username.trim(), password: password.trim() });
    }

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        reset();
        if (!username.trim() || !email.trim() || !password.trim()) {
            setFieldError("Preencha todos os campos.");
            return;
        }
        if (password.length < 6) {
            setFieldError("Senha deve ter pelo menos 6 caracteres.");
            return;
        }
        await register({ username: username.trim(), email: email.trim(), password: password.trim() });
    }

    async function handleGuest(e: React.FormEvent) {
        e.preventDefault();
        reset();
        if (!guestName.trim()) {
            setFieldError("Digite um apelido.");
            return;
        }
        await loginAsGuest(guestName.trim());
    }

    if (!open) return null;

    const isGuest = !!user && "isGuest" in user && user.isGuest;

    // ── Logged in state ────────────────────────────────────────────────────
    if (user) {
        return (
            <div className={styles.overlay} onClick={onClose}>
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
                        ✕
                    </button>
                    <div className={styles.header}>
                        <h3 className={styles.title}>Meu Perfil</h3>
                    </div>

                    {(fieldError ?? error) && (
                        <p className={styles.errorMsg}>{fieldError ?? error}</p>
                    )}
                    {successMsg && <p className={styles.successMsg}>{successMsg}</p>}

                    <div className={styles.userBar}>
                        {/* Avatar — click to change */}
                        {!isGuest ? (
                            <div
                                className={styles.avatarWrapper}
                                onClick={() => fileInputRef.current?.click()}
                                title="Clique para trocar o avatar"
                            >
                                {user.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt="avatar"
                                        className={styles.avatarImg}
                                    />
                                ) : (
                                    <span className={styles.userAvatar}>
                                        {user.username[0]?.toUpperCase() ?? "?"}
                                    </span>
                                )}
                                <span className={styles.avatarOverlay}>✎</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    hidden
                                    onChange={handleAvatarChange}
                                />
                            </div>
                        ) : (
                            <span className={styles.userAvatar}>
                                {user.username[0]?.toUpperCase() ?? "?"}
                            </span>
                        )}

                        <div className={styles.userInfo}>
                            <span className={styles.userName}>
                                {user.username}
                                {isGuest && (
                                    <span className={styles.guestBadge}> convidado</span>
                                )}
                            </span>
                            <span className={styles.userCoins}>🪙 {user.coins} moedas</span>
                        </div>
                    </div>

                    {/* ── Editing mode ── */}
                    {editing && !isGuest ? (
                        <div className={styles.editSection}>
                            <div className={styles.editRow}>
                                <label className={styles.editLabel}>Nome de usuário</label>
                                <input
                                    className={styles.editInput}
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    maxLength={20}
                                />
                            </div>
                            <div className={styles.editRow}>
                                <label className={styles.editLabel}>Bio</label>
                                <textarea
                                    className={styles.editInput}
                                    value={editBio}
                                    onChange={(e) => setEditBio(e.target.value)}
                                    maxLength={200}
                                    rows={3}
                                    placeholder="Conte sobre você..."
                                />
                            </div>
                            <div className={styles.editActions}>
                                <Button variant="primary" fullWidth onClick={saveProfile} disabled={loading}>
                                    {loading ? "Salvando…" : "Salvar"}
                                </Button>
                                <Button variant="ghost" fullWidth onClick={() => { setEditing(false); reset(); }}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {user.bio && (
                                <p style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                                    {user.bio}
                                </p>
                            )}

                            {!isGuest && (
                                <Button variant="secondary" fullWidth onClick={startEditing}>
                                    Editar Perfil
                                </Button>
                            )}
                        </>
                    )}

                    <Button variant="ghost" fullWidth onClick={() => { logout(); onClose(); }}>
                        Sair da Conta
                    </Button>
                </div>
            </div>
        );
    }

    // ── Auth form ──────────────────────────────────────────────────────────
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
                    ✕
                </button>

                <div className={styles.header}>
                    <h3 className={styles.title}>Entrar no IZMA</h3>
                    <p className={styles.subtitle}>Crie uma conta ou jogue como convidado</p>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${tab === "login" ? styles.activeTab : ""}`}
                        onClick={() => switchTab("login")}
                        type="button"
                    >
                        Login
                    </button>
                    <button
                        className={`${styles.tab} ${tab === "register" ? styles.activeTab : ""}`}
                        onClick={() => switchTab("register")}
                        type="button"
                    >
                        Registrar
                    </button>
                </div>

                {(fieldError ?? error) && (
                    <p className={styles.errorMsg}>{fieldError ?? error}</p>
                )}

                {tab === "login" && (
                    <form className={styles.form} onSubmit={handleLogin} noValidate>
                        <Input
                            id="login-user"
                            label="Usuário"
                            placeholder="Seu nome de usuário"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            maxLength={20}
                            autoComplete="username"
                            autoFocus
                        />
                        <Input
                            id="login-pass"
                            label="Senha"
                            placeholder="Sua senha"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            maxLength={64}
                            autoComplete="current-password"
                        />
                        <Button type="submit" variant="primary" fullWidth disabled={loading}>
                            {loading ? "Entrando…" : "Entrar"}
                        </Button>
                    </form>
                )}

                {tab === "register" && (
                    <form className={styles.form} onSubmit={handleRegister} noValidate>
                        <Input
                            id="reg-user"
                            label="Usuário"
                            placeholder="Ex: Thunderbolt"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            maxLength={20}
                            autoComplete="username"
                            autoFocus
                        />
                        <Input
                            id="reg-email"
                            label="E-mail"
                            placeholder="voce@email.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                        <Input
                            id="reg-pass"
                            label="Senha"
                            placeholder="Mínimo 6 caracteres"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            maxLength={64}
                            autoComplete="new-password"
                        />
                        <Button type="submit" variant="primary" fullWidth disabled={loading}>
                            {loading ? "Registrando…" : "Criar Conta"}
                        </Button>
                    </form>
                )}

                <div className={styles.divider}>ou</div>

                <form className={styles.form} onSubmit={handleGuest} noValidate>
                    <Input
                        id="guest-name"
                        label="Jogar como convidado"
                        placeholder="Apelido temporário"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        maxLength={20}
                        autoComplete="off"
                    />
                    <Button type="submit" variant="secondary" fullWidth disabled={loading}>
                        {loading ? "Entrando…" : "⚡ Entrar como Convidado"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
