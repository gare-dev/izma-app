import { useState, useEffect, useRef } from "react";
import { useGameStore, type RoomChatMessage } from "@/store/useGameStore";
import styles from "./RoomChat.module.css";

function MsgAvatar({ msg }: { msg: RoomChatMessage }) {
    if (msg.avatarUrl) {
        return <img src={msg.avatarUrl} alt="" className={styles.msgAvatar} />;
    }
    return (
        <span className={styles.msgAvatarFallback}>
            {msg.username[0]?.toUpperCase() ?? "?"}
        </span>
    );
}

export default function RoomChat() {
    const { roomMessages, sendRoomMessage, status } = useGameStore();
    const connected = status === "connected";
    const [input, setInput] = useState("");
    const [cooldown, setCooldown] = useState(false);
    const [profileUser, setProfileUser] = useState<RoomChatMessage | null>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // Auto-scroll on new messages
    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [roomMessages]);

    function handleSend(e: React.FormEvent) {
        e.preventDefault();
        if (!input.trim() || cooldown) return;

        const sent = sendRoomMessage(input);
        if (sent) {
            setInput("");
        } else {
            setCooldown(true);
            setTimeout(() => setCooldown(false), 2000);
        }
    }

    return (
        <div className={styles.chat}>
            <div className={styles.header}>
                <span className={styles.headerTitle}>💬 Chat da Sala</span>
                <span className={`${styles.statusDot} ${connected ? styles.online : ""}`} />
            </div>

            <ul ref={listRef} className={styles.messages}>
                {roomMessages.length === 0 && (
                    <li className={styles.empty}>Nenhuma mensagem ainda.</li>
                )}
                {roomMessages.map((m, i) => (
                    <li key={`${m.timestamp}-${i}`} className={styles.msg}>
                        <button
                            type="button"
                            className={styles.msgAvatarBtn}
                            onClick={() => setProfileUser(m)}
                            aria-label={`Perfil de ${m.username}`}
                        >
                            <MsgAvatar msg={m} />
                        </button>
                        <div className={styles.msgBody}>
                            <button
                                type="button"
                                className={styles.msgUser}
                                onClick={() => setProfileUser(m)}
                            >
                                {m.username}
                            </button>
                            <span className={styles.msgText}>{m.message}</span>
                        </div>
                    </li>
                ))}
            </ul>

            <form className={styles.inputRow} onSubmit={handleSend}>
                <input
                    className={styles.input}
                    type="text"
                    placeholder={cooldown ? "Aguarde..." : "Digite uma mensagem"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={200}
                    disabled={!connected || cooldown}
                    autoComplete="off"
                />
                <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={!connected || !input.trim() || cooldown}
                >
                    ↑
                </button>
            </form>

            {/* ── Mini profile popover ── */}
            {profileUser && (
                <div className={styles.profileOverlay} onClick={() => setProfileUser(null)}>
                    <div className={styles.profileCard} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className={styles.profileClose} onClick={() => setProfileUser(null)}>✕</button>
                        {profileUser.avatarUrl ? (
                            <img src={profileUser.avatarUrl} alt="" className={styles.profileAvatar} />
                        ) : (
                            <span className={styles.profileAvatarFallback}>
                                {profileUser.username[0]?.toUpperCase() ?? "?"}
                            </span>
                        )}
                        <span className={styles.profileName}>{profileUser.username}</span>
                        {profileUser.bio && (
                            <span className={styles.profileBio}>{profileUser.bio}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
