// ─── Clan Service ───────────────────────────────────────────────────────────
// Business logic for clan CRUD, membership, and chat persistence.

import { v4 as uuid } from "uuid";
import crypto from "crypto";
import type {
    Clan,
    ClanDetail,
    ClanMember,
    ClanJoinMode,
    PublicClanInfo,
    ClanChatMessage,
    CreateClanDTO,
    UpdateClanDTO,
} from "@izma/types";
import { query } from "../../db.ts";
import { addCoinsToUser, getUserBalance } from "../auth/auth.service.ts";

// ─── Constants ──────────────────────────────────────────────────────────────

export const CLAN_CREATION_COST = 50;
const INVITE_CODE_LENGTH = 8;
const MAX_CLAN_NAME_LENGTH = 30;
const MAX_BIO_LENGTH = 500;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
    return crypto.randomBytes(INVITE_CODE_LENGTH / 2).toString("hex");
}

function rowToClan(row: any): Clan {
    return {
        id: row.id,
        name: row.name,
        bio: row.bio,
        avatarUrl: row.avatar_url,
        joinMode: row.join_mode,
        ownerId: row.owner_id,
        inviteCode: row.invite_code,
        memberCount: Number(row.member_count ?? 0),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
}

function rowToMember(row: any): ClanMember {
    return {
        userId: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
        role: row.role,
        status: row.status,
        joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : row.joined_at,
    };
}

function rowToMessage(row: any): ClanChatMessage {
    return {
        id: row.id,
        clanId: row.clan_id,
        userId: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
        message: row.message,
        timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createClan(
    ownerId: string,
    dto: CreateClanDTO,
): Promise<{ clan: Clan } | { error: string }> {
    // Check balance
    const balance = await getUserBalance(ownerId);
    if (balance === null || balance < CLAN_CREATION_COST) {
        return { error: "Moedas insuficientes. Necessário: 50 moedas." };
    }

    // Check user isn't already a clan owner
    const existing = await query(
        `SELECT 1 FROM clans WHERE owner_id = $1 LIMIT 1`,
        [ownerId],
    );
    if ((existing.rowCount ?? 0) > 0) {
        return { error: "Você já possui um clã." };
    }

    const name = dto.name.trim();
    if (name.length < 2 || name.length > MAX_CLAN_NAME_LENGTH) {
        return { error: `Nome deve ter entre 2 e ${MAX_CLAN_NAME_LENGTH} caracteres.` };
    }

    // Check name uniqueness
    const nameTaken = await query(
        `SELECT 1 FROM clans WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [name],
    );
    if ((nameTaken.rowCount ?? 0) > 0) {
        return { error: "Já existe um clã com esse nome." };
    }

    const bio = dto.bio?.slice(0, MAX_BIO_LENGTH) ?? null;
    const joinMode: ClanJoinMode = dto.joinMode ?? "public";
    const inviteCode = generateInviteCode();
    const id = uuid();

    // Deduct coins
    const newBalance = await addCoinsToUser(ownerId, -CLAN_CREATION_COST);
    if (newBalance === null) {
        return { error: "Erro ao debitar moedas." };
    }

    // Insert clan
    const result = await query(
        `INSERT INTO clans (id, name, bio, join_mode, owner_id, invite_code)
         VALUES ($1, $2, $3, $4::clan_join_mode, $5, $6)
         RETURNING *`,
        [id, name, bio, joinMode, ownerId, inviteCode],
    );

    // Add owner as member
    await query(
        `INSERT INTO clan_members (clan_id, user_id, role, status)
         VALUES ($1, $2, 'owner'::clan_role, 'active'::clan_member_status)`,
        [id, ownerId],
    );

    const clan = rowToClan({ ...result.rows[0], member_count: 1 });
    return { clan };
}

// ─── Get by ID ──────────────────────────────────────────────────────────────

export async function getClanById(clanId: string): Promise<Clan | null> {
    const result = await query(
        `SELECT c.*, COUNT(cm.user_id) FILTER (WHERE cm.status = 'active') AS member_count
         FROM clans c
         LEFT JOIN clan_members cm ON cm.clan_id = c.id
         WHERE c.id = $1
         GROUP BY c.id`,
        [clanId],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return rowToClan(result.rows[0]);
}

// ─── Get Detail (with members) ──────────────────────────────────────────────

export async function getClanDetail(clanId: string): Promise<ClanDetail | null> {
    const clan = await getClanById(clanId);
    if (!clan) return null;

    const membersResult = await query(
        `SELECT cm.user_id, u.username, u.avatar_url, cm.role, cm.status, cm.joined_at
         FROM clan_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.clan_id = $1
         ORDER BY cm.role = 'owner' DESC, cm.role = 'admin' DESC, cm.joined_at ASC`,
        [clanId],
    );

    const members = membersResult.rows.map(rowToMember);
    return { ...clan, members };
}

// ─── Get by Invite Code ─────────────────────────────────────────────────────

export async function getClanByInviteCode(code: string): Promise<Clan | null> {
    const result = await query(
        `SELECT c.*, COUNT(cm.user_id) FILTER (WHERE cm.status = 'active') AS member_count
         FROM clans c
         LEFT JOIN clan_members cm ON cm.clan_id = c.id
         WHERE c.invite_code = $1
         GROUP BY c.id`,
        [code],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return rowToClan(result.rows[0]);
}

// ─── List (search) ──────────────────────────────────────────────────────────

export async function listClans(search?: string): Promise<PublicClanInfo[]> {
    let sql = `
        SELECT c.id, c.name, c.bio, c.avatar_url, c.join_mode,
               u.username AS owner_username,
               COUNT(cm.user_id) FILTER (WHERE cm.status = 'active') AS member_count
        FROM clans c
        JOIN users u ON u.id = c.owner_id
        LEFT JOIN clan_members cm ON cm.clan_id = c.id
    `;
    const params: unknown[] = [];

    if (search && search.trim().length > 0) {
        sql += ` WHERE LOWER(c.name) LIKE $1`;
        params.push(`%${search.trim().toLowerCase()}%`);
    }

    sql += ` GROUP BY c.id, u.username ORDER BY member_count DESC, c.created_at DESC LIMIT 50`;

    const result = await query(sql, params);
    return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        bio: row.bio,
        avatarUrl: row.avatar_url,
        joinMode: row.join_mode,
        ownerUsername: row.owner_username,
        memberCount: Number(row.member_count),
    }));
}

// ─── Get User's Clan ────────────────────────────────────────────────────────

export async function getUserClan(userId: string): Promise<Clan | null> {
    const result = await query(
        `SELECT c.*, COUNT(cm2.user_id) FILTER (WHERE cm2.status = 'active') AS member_count
         FROM clan_members cm
         JOIN clans c ON c.id = cm.clan_id
         LEFT JOIN clan_members cm2 ON cm2.clan_id = c.id
         WHERE cm.user_id = $1 AND cm.status = 'active'
         GROUP BY c.id
         LIMIT 1`,
        [userId],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return rowToClan(result.rows[0]);
}

// ─── Join ───────────────────────────────────────────────────────────────────

export async function joinClan(
    clanId: string,
    userId: string,
): Promise<{ status: "joined" | "pending" } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };

    if (clan.joinMode === "private") {
        return { error: "Este clã é privado. Necessário convite." };
    }

    // Check if already a member/pending somewhere
    const existing = await query(
        `SELECT clan_id, status FROM clan_members WHERE user_id = $1`,
        [userId],
    );
    if ((existing.rowCount ?? 0) > 0) {
        const row = existing.rows[0];
        if (row.clan_id === clanId && row.status === "active") {
            return { error: "Você já é membro deste clã." };
        }
        if (row.clan_id === clanId && row.status === "pending") {
            return { error: "Você já tem pedido pendente neste clã." };
        }
        if (row.status === "active") {
            return { error: "Você já é membro de outro clã. Saia primeiro." };
        }
    }

    const status = clan.joinMode === "approval" ? "pending" : "active";

    await query(
        `INSERT INTO clan_members (clan_id, user_id, role, status)
         VALUES ($1, $2, 'member'::clan_role, $3::clan_member_status)
         ON CONFLICT (clan_id, user_id) DO UPDATE SET status = $3::clan_member_status`,
        [clanId, userId, status],
    );

    return { status: status === "active" ? "joined" : "pending" };
}

// ─── Join via Invite ────────────────────────────────────────────────────────

export async function joinClanByInvite(
    inviteCode: string,
    userId: string,
): Promise<{ clan: Clan } | { error: string }> {
    const clan = await getClanByInviteCode(inviteCode);
    if (!clan) return { error: "Convite inválido ou expirado." };

    // Check if already member somewhere
    const existing = await query(
        `SELECT clan_id, status FROM clan_members WHERE user_id = $1 AND status = 'active'`,
        [userId],
    );
    if ((existing.rowCount ?? 0) > 0) {
        if (existing.rows[0].clan_id === clan.id) {
            return { error: "Você já é membro deste clã." };
        }
        return { error: "Você já é membro de outro clã. Saia primeiro." };
    }

    // Invite bypasses join mode — direct join
    await query(
        `INSERT INTO clan_members (clan_id, user_id, role, status)
         VALUES ($1, $2, 'member'::clan_role, 'active'::clan_member_status)
         ON CONFLICT (clan_id, user_id) DO UPDATE SET status = 'active'::clan_member_status`,
        [clan.id, userId],
    );

    return { clan };
}

// ─── Accept / Reject pending member ─────────────────────────────────────────

export async function acceptMember(clanId: string, targetUserId: string, actorId: string): Promise<{ ok: boolean } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };

    // Check actor is owner or admin
    const actor = await query(
        `SELECT role FROM clan_members WHERE clan_id = $1 AND user_id = $2 AND status = 'active'`,
        [clanId, actorId],
    );
    if ((actor.rowCount ?? 0) === 0) return { error: "Sem permissão." };
    const actorRole = actor.rows[0].role;
    if (actorRole !== "owner" && actorRole !== "admin") return { error: "Sem permissão." };

    const result = await query(
        `UPDATE clan_members SET status = 'active'::clan_member_status
         WHERE clan_id = $1 AND user_id = $2 AND status = 'pending'
         RETURNING user_id`,
        [clanId, targetUserId],
    );
    if ((result.rowCount ?? 0) === 0) return { error: "Pedido não encontrado." };

    return { ok: true };
}

export async function rejectMember(clanId: string, targetUserId: string, actorId: string): Promise<{ ok: boolean } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };

    const actor = await query(
        `SELECT role FROM clan_members WHERE clan_id = $1 AND user_id = $2 AND status = 'active'`,
        [clanId, actorId],
    );
    if ((actor.rowCount ?? 0) === 0) return { error: "Sem permissão." };
    const actorRole = actor.rows[0].role;
    if (actorRole !== "owner" && actorRole !== "admin") return { error: "Sem permissão." };

    await query(
        `DELETE FROM clan_members WHERE clan_id = $1 AND user_id = $2 AND status = 'pending'`,
        [clanId, targetUserId],
    );

    return { ok: true };
}

// ─── Leave ──────────────────────────────────────────────────────────────────

export async function leaveClan(clanId: string, userId: string): Promise<{ ok: boolean } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };

    if (clan.ownerId === userId) {
        return { error: "O dono não pode sair do clã. Transfira ou delete." };
    }

    await query(
        `DELETE FROM clan_members WHERE clan_id = $1 AND user_id = $2`,
        [clanId, userId],
    );

    return { ok: true };
}

// ─── Kick ───────────────────────────────────────────────────────────────────

export async function kickMember(clanId: string, targetUserId: string, actorId: string): Promise<{ ok: boolean } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };

    if (targetUserId === clan.ownerId) return { error: "Não é possível expulsar o dono." };

    const actor = await query(
        `SELECT role FROM clan_members WHERE clan_id = $1 AND user_id = $2 AND status = 'active'`,
        [clanId, actorId],
    );
    if ((actor.rowCount ?? 0) === 0) return { error: "Sem permissão." };
    if (actor.rows[0].role !== "owner" && actor.rows[0].role !== "admin") return { error: "Sem permissão." };

    await query(
        `DELETE FROM clan_members WHERE clan_id = $1 AND user_id = $2`,
        [clanId, targetUserId],
    );

    return { ok: true };
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateClan(
    clanId: string,
    actorId: string,
    dto: UpdateClanDTO,
): Promise<{ clan: Clan } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };
    if (clan.ownerId !== actorId) return { error: "Apenas o dono pode editar o clã." };

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
        const name = dto.name.trim();
        if (name.length < 2 || name.length > MAX_CLAN_NAME_LENGTH) {
            return { error: `Nome deve ter entre 2 e ${MAX_CLAN_NAME_LENGTH} caracteres.` };
        }
        const nameTaken = await query(
            `SELECT 1 FROM clans WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1`,
            [name, clanId],
        );
        if ((nameTaken.rowCount ?? 0) > 0) return { error: "Já existe um clã com esse nome." };
        fields.push(`name = $${idx++}`);
        values.push(name);
    }
    if (dto.bio !== undefined) {
        fields.push(`bio = $${idx++}`);
        values.push(dto.bio?.slice(0, MAX_BIO_LENGTH) ?? null);
    }
    if (dto.joinMode !== undefined) {
        fields.push(`join_mode = $${idx++}::clan_join_mode`);
        values.push(dto.joinMode);
    }

    if (fields.length === 0) {
        return { clan };
    }

    values.push(clanId);
    await query(
        `UPDATE clans SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
        values,
    );

    const updated = await getClanById(clanId);
    return { clan: updated! };
}

// ─── Upload Avatar ──────────────────────────────────────────────────────────

export async function updateClanAvatar(clanId: string, avatarUrl: string): Promise<void> {
    await query(`UPDATE clans SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, [avatarUrl, clanId]);
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteClan(clanId: string, actorId: string): Promise<{ ok: boolean } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };
    if (clan.ownerId !== actorId) return { error: "Apenas o dono pode deletar o clã." };

    await query(`DELETE FROM clans WHERE id = $1`, [clanId]);
    return { ok: true };
}

// ─── Regenerate Invite Code ─────────────────────────────────────────────────

export async function regenerateInvite(clanId: string, actorId: string): Promise<{ inviteCode: string } | { error: string }> {
    const clan = await getClanById(clanId);
    if (!clan) return { error: "Clã não encontrado." };
    if (clan.ownerId !== actorId) return { error: "Apenas o dono pode gerar novo convite." };

    const newCode = generateInviteCode();
    await query(`UPDATE clans SET invite_code = $1, updated_at = NOW() WHERE id = $2`, [newCode, clanId]);

    return { inviteCode: newCode };
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export async function saveClanMessage(
    clanId: string,
    userId: string,
    message: string,
): Promise<ClanChatMessage> {
    const id = uuid();
    await query(
        `INSERT INTO clan_messages (id, clan_id, user_id, message)
         VALUES ($1, $2, $3, $4)`,
        [id, clanId, userId, message.slice(0, 500)],
    );

    const userResult = await query(
        `SELECT username, avatar_url FROM users WHERE id = $1`,
        [userId],
    );
    const user = userResult.rows[0];

    return {
        id,
        clanId,
        userId,
        username: user?.username ?? "???",
        avatarUrl: user?.avatar_url ?? null,
        message: message.slice(0, 500),
        timestamp: new Date().toISOString(),
    };
}

export async function getClanMessages(clanId: string, limit = 50): Promise<ClanChatMessage[]> {
    const result = await query(
        `SELECT m.id, m.clan_id, m.user_id, u.username, u.avatar_url, m.message, m.created_at
         FROM clan_messages m
         JOIN users u ON u.id = m.user_id
         WHERE m.clan_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [clanId, limit],
    );
    return result.rows.map(rowToMessage).reverse();
}

// ─── Check membership ───────────────────────────────────────────────────────

export async function isClanMember(clanId: string, userId: string): Promise<boolean> {
    const result = await query(
        `SELECT 1 FROM clan_members WHERE clan_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
        [clanId, userId],
    );
    return (result.rowCount ?? 0) > 0;
}
