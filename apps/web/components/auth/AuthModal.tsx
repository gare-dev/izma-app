import { useState, useCallback } from "react";
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
    const { user, token, loading, error, login, register, loginAsGuest, logout, clearError } =
        useAuthStore();

    const [tab, setTab] = useState<AuthTab>("login");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [guestName, setGuestName] = useState("");
    const [fieldError, setFieldError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setFieldError(null);
        clearError();
    }, [clearError]);

    function switchTab(t: AuthTab) {
        setTab(t);
        reset();
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

    // ── Logged in state ────────────────────────────────────────────────────
    if (user && token) {
        return (
            <div className={styles.overlay} onClick={onClose}>
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
                        ✕
                    </button>
                    <div className={styles.header}>
                        <h3 className={styles.title}>Meu Perfil</h3>
                    </div>

                    <div className={styles.userBar}>
                        <span className={styles.userAvatar}>
                            {user.username[0]?.toUpperCase() ?? "?"}
                        </span>
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>
                                {user.username}
                                {"isGuest" in user && user.isGuest && (
                                    <span className={styles.guestBadge}> convidado</span>
                                )}
                            </span>
                            <span className={styles.userCoins}>🪙 {user.coins} moedas</span>
                        </div>
                    </div>

                    {user.bio && (
                        <p style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                            {user.bio}
                        </p>
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
