import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { ClanDetail, ClanMember, ClanJoinMode } from "@izma/types";
import { useClanStore } from "@/store/useClanStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useGameStore } from "@/store/useGameStore";
import styles from "@/styles/Clans.module.css";

type Tab = "members" | "chat";

const MODE_LABELS: Record<ClanJoinMode, string> = {
    public: "Público",
    private: "Privado",
    approval: "Aprovação",
};

const ROLE_CLASS: Record<string, string> = {
    owner: styles.roleOwner,
    admin: styles.roleAdmin,
    member: styles.roleMember,
};

const ROLE_LABEL: Record<string, string> = {
    owner: "Dono",
    admin: "Admin",
    member: "Membro",
};

export default function ClanDetailPage() {
    const router = useRouter();
    const { id } = router.query;
    const user = useAuthStore((s) => s.user);
    const ws = useGameStore((s) => s.ws);
    const connect = useGameStore((s) => s.connect);
    const {
        messages,
        fetchClanDetail,
        fetchClanMessages,
        sendClanMessage,
        joinClan,
        leaveClan,
        acceptMember,
        rejectMember,
        kickMember,
        regenerateInvite,
        deleteClan,
        loading,
        error,
        clearError,
    } = useClanStore();

    const [clan, setClan] = useState<ClanDetail | null>(null);
    const [tab, setTab] = useState<Tab>("members");
    const [chatInput, setChatInput] = useState("");
    const [copied, setCopied] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const isMember = clan?.members.some(
        (m) => m.userId === user?.id && m.status === "active"
    ) ?? false;
    const isOwner = clan?.ownerId === user?.id;
    const isAdminPlus = clan?.members.some(
        (m) => m.userId === user?.id && (m.role === "owner" || m.role === "admin") && m.status === "active"
    ) ?? false;
    const isPending = clan?.members.some(
        (m) => m.userId === user?.id && m.status === "pending"
    ) ?? false;

    const loadClan = useCallback(async () => {
        if (!id || typeof id !== "string") return;
        const detail = await fetchClanDetail(id);
        if (detail) setClan(detail);
    }, [id, fetchClanDetail]);

    useEffect(() => {
        loadClan();
    }, [loadClan]);

    // Ensure WS is connected when opening chat tab
    useEffect(() => {
        if (tab === "chat" && clan && isMember && (!ws || ws.readyState === WebSocket.CLOSED)) {
            connect();
        }
    }, [tab, clan, isMember, ws, connect]);

    // Load chat messages when switching to chat tab
    useEffect(() => {
        if (tab === "chat" && clan && isMember) {
            fetchClanMessages(clan.id);
        }
    }, [tab, clan, isMember, fetchClanMessages]);

    // Subscribe / unsubscribe to clan chat WS room
    useEffect(() => {
        if (tab !== "chat" || !clan || !isMember || !ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "CLAN_CHAT_JOIN", payload: { clanId: clan.id } }));
        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "CLAN_CHAT_LEAVE", payload: { clanId: clan.id } }));
            }
        };
    }, [tab, clan, isMember, ws]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendChat = () => {
        if (!clan || !chatInput.trim()) return;
        const sent = sendClanMessage(ws, clan.id, chatInput);
        if (sent) setChatInput("");
    };

    const handleChatKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendChat();
        }
    };

    const handleJoin = async () => {
        if (!clan) return;
        const status = await joinClan(clan.id);
        if (status) await loadClan();
    };

    const handleLeave = async () => {
        if (!clan) return;
        await leaveClan(clan.id);
        router.push("/clans");
    };

    const handleDelete = async () => {
        if (!clan || !confirm("Tem certeza que deseja deletar o clã?")) return;
        await deleteClan(clan.id);
        router.push("/clans");
    };

    const handleCopyInvite = () => {
        if (!clan) return;
        const url = `${window.location.origin}/clans/invite/${clan.inviteCode}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRegenInvite = async () => {
        if (!clan) return;
        await regenerateInvite(clan.id);
        await loadClan();
    };

    if (!clan && loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}><span className="spinner" /></div>
            </div>
        );
    }

    if (!clan) {
        return (
            <div className={styles.page}>
                <p className={styles.empty}>Clã não encontrado.</p>
                <button className={styles.backBtn} onClick={() => router.push("/clans")} type="button">
                    ← Voltar aos clãs
                </button>
            </div>
        );
    }

    const pendingMembers = clan.members.filter((m) => m.status === "pending");
    const activeMembers = clan.members.filter((m) => m.status === "active");

    return (
        <>
            <Head>
                <title>IZMA — {clan.name}</title>
            </Head>

            <div className={styles.page}>
                {/* Header */}
                <div className={styles.header}>
                    <span className={styles.logo} onClick={() => router.push("/")}>
                        ⚡ IZMA
                    </span>
                    <button className={styles.backBtn} onClick={() => router.push("/clans")} type="button">
                        ← Clãs
                    </button>
                </div>

                {/* Detail card */}
                <div className={styles.detailCard}>
                    {clan.avatarUrl ? (
                        <img src={clan.avatarUrl} alt="" className={styles.detailAvatar} />
                    ) : (
                        <span className={styles.detailAvatarFallback}>
                            {clan.name[0]?.toUpperCase() ?? "?"}
                        </span>
                    )}

                    <div className={styles.detailName}>{clan.name}</div>
                    {clan.bio && <div className={styles.detailBio}>{clan.bio}</div>}

                    <div className={styles.detailStats}>
                        <span>👥 <span className={styles.detailStatValue}>{clan.memberCount}</span> membros</span>
                        <span>🔒 {MODE_LABELS[clan.joinMode]}</span>
                    </div>

                    {error && <div className={styles.errorMsg}>{error}</div>}

                    <div className={styles.detailActions}>
                        {!isMember && !isPending && user && !("isGuest" in user && user.isGuest) && (
                            <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={handleJoin} type="button">
                                {clan.joinMode === "approval" ? "Solicitar entrada" : "Entrar"}
                            </button>
                        )}
                        {isPending && (
                            <span className={styles.pendingBadge}>⏳ Pedido pendente</span>
                        )}
                        {isMember && !isOwner && (
                            <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={handleLeave} type="button">
                                Sair
                            </button>
                        )}
                        {isOwner && (
                            <>
                                <button className={styles.actionBtn} onClick={() => router.push(`/clans/${clan.id}/edit`)} type="button">
                                    ✏️ Editar
                                </button>
                                <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={handleDelete} type="button">
                                    🗑️ Deletar
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Invite link (owner/admin) */}
                {isAdminPlus && (
                    <div className={styles.inviteSection}>
                        <div className={styles.sectionTitle}>🔗 Link de convite</div>
                        <div className={styles.inviteRow}>
                            <input
                                className={styles.inviteInput}
                                readOnly
                                value={`${typeof window !== "undefined" ? window.location.origin : ""}/clans/invite/${clan.inviteCode}`}
                            />
                            <button className={styles.copyBtn} onClick={handleCopyInvite} type="button">
                                {copied ? "✓ Copiado!" : "Copiar"}
                            </button>
                        </div>
                        {isOwner && (
                            <button className={styles.smallBtn} onClick={handleRegenInvite} type="button">
                                🔄 Gerar novo link
                            </button>
                        )}
                    </div>
                )}

                {/* Tabs */}
                {isMember && (
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${tab === "members" ? styles.tabActive : ""}`}
                            onClick={() => setTab("members")}
                            type="button"
                        >
                            👥 Membros
                        </button>
                        <button
                            className={`${styles.tab} ${tab === "chat" ? styles.tabActive : ""}`}
                            onClick={() => setTab("chat")}
                            type="button"
                        >
                            💬 Chat
                        </button>
                    </div>
                )}

                {/* Members tab */}
                {(tab === "members" || !isMember) && (
                    <div className={styles.section}>
                        {/* Pending members (admin+) */}
                        {isAdminPlus && pendingMembers.length > 0 && (
                            <>
                                <div className={styles.sectionTitle}>⏳ Pedidos pendentes</div>
                                <div className={styles.memberList} style={{ marginBottom: "1rem" }}>
                                    {pendingMembers.map((m) => (
                                        <MemberRow
                                            key={m.userId}
                                            member={m}
                                            clanId={clan.id}
                                            isAdminPlus={true}
                                            isOwner={isOwner}
                                            isPending={true}
                                            ownerId={clan.ownerId}
                                            currentUserId={user?.id ?? ""}
                                            onAccept={async () => { await acceptMember(clan.id, m.userId); await loadClan(); }}
                                            onReject={async () => { await rejectMember(clan.id, m.userId); await loadClan(); }}
                                            onKick={async () => { }}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        <div className={styles.sectionTitle}>👥 Membros ({activeMembers.length})</div>
                        <div className={styles.memberList}>
                            {activeMembers.map((m) => (
                                <MemberRow
                                    key={m.userId}
                                    member={m}
                                    clanId={clan.id}
                                    isAdminPlus={isAdminPlus}
                                    isOwner={isOwner}
                                    isPending={false}
                                    ownerId={clan.ownerId}
                                    currentUserId={user?.id ?? ""}
                                    onAccept={async () => { }}
                                    onReject={async () => { }}
                                    onKick={async () => { await kickMember(clan.id, m.userId); await loadClan(); }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Chat tab */}
                {tab === "chat" && isMember && (
                    <div className={styles.chatSection}>
                        <div className={styles.chatMessages}>
                            {messages.length === 0 && (
                                <p className={styles.empty}>Nenhuma mensagem ainda.</p>
                            )}
                            {messages.map((msg) => (
                                <div key={msg.id} className={styles.chatMsg}>
                                    {msg.avatarUrl ? (
                                        <img src={msg.avatarUrl} alt="" className={styles.chatMsgAvatar} />
                                    ) : (
                                        <span className={styles.chatMsgAvatarFallback}>
                                            {msg.username[0]?.toUpperCase() ?? "?"}
                                        </span>
                                    )}
                                    <div className={styles.chatMsgBody}>
                                        <span className={styles.chatMsgAuthor}>{msg.username}</span>{" "}
                                        <span className={styles.chatMsgText}>{msg.message}</span>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className={styles.chatInputRow}>
                            <input
                                className={styles.chatInput}
                                placeholder="Mensagem..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={handleChatKeyDown}
                                maxLength={500}
                            />
                            <button className={styles.chatSendBtn} onClick={handleSendChat} type="button">
                                Enviar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ─── Member Row Component ───────────────────────────────────────────────────

function MemberRow({
    member,
    clanId,
    isAdminPlus,
    isOwner,
    isPending,
    ownerId,
    currentUserId,
    onAccept,
    onReject,
    onKick,
}: {
    member: ClanMember;
    clanId: string;
    isAdminPlus: boolean;
    isOwner: boolean;
    isPending: boolean;
    ownerId: string;
    currentUserId: string;
    onAccept: () => Promise<void>;
    onReject: () => Promise<void>;
    onKick: () => Promise<void>;
}) {
    const canKick =
        isAdminPlus &&
        member.userId !== currentUserId &&
        member.userId !== ownerId;

    return (
        <div className={styles.memberRow}>
            {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className={styles.memberAvatar} />
            ) : (
                <span className={styles.memberAvatarFallback}>
                    {member.username[0]?.toUpperCase() ?? "?"}
                </span>
            )}

            <div className={styles.memberInfo}>
                <span className={styles.memberName}>{member.username}</span>
            </div>

            <span className={`${styles.memberRole} ${ROLE_CLASS[member.role] ?? styles.roleMember}`}>
                {ROLE_LABEL[member.role] ?? member.role}
            </span>

            <div className={styles.memberActions}>
                {isPending && (
                    <>
                        <button className={`${styles.smallBtn} ${styles.acceptBtn}`} onClick={onAccept} type="button">
                            ✓
                        </button>
                        <button className={`${styles.smallBtn} ${styles.rejectBtn}`} onClick={onReject} type="button">
                            ✕
                        </button>
                    </>
                )}
                {!isPending && canKick && (
                    <button className={`${styles.smallBtn} ${styles.rejectBtn}`} onClick={onKick} type="button">
                        Expulsar
                    </button>
                )}
            </div>
        </div>
    );
}
