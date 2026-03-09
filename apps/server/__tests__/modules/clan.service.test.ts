import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../src/db.ts", () => ({
    query: vi.fn(),
    pool: { query: vi.fn() },
}));

vi.mock("../../src/modules/auth/auth.service.ts", () => ({
    getUserBalance: vi.fn(),
    addCoinsToUser: vi.fn(),
}));

import {
    createClan,
    getClanById,
    getClanDetail,
    getClanByInviteCode,
    listClans,
    getUserClan,
    joinClan,
    joinClanByInvite,
    acceptMember,
    rejectMember,
    leaveClan,
    kickMember,
    updateClan,
    updateClanAvatar,
    deleteClan,
    regenerateInvite,
    saveClanMessage,
    getClanMessages,
    isClanMember,
    CLAN_CREATION_COST,
} from "../../src/modules/clans/clan.service";
import { query } from "../../src/db";
import { getUserBalance, addCoinsToUser } from "../../src/modules/auth/auth.service";

const mockQuery = vi.mocked(query);
const mockGetBalance = vi.mocked(getUserBalance);
const mockAddCoins = vi.mocked(addCoinsToUser);

// ─── Helpers ────────────────────────────────────────────────────────────────

const clanRow = {
    id: "c1",
    name: "Warriors",
    bio: "A clan",
    avatar_url: null,
    join_mode: "public",
    owner_id: "u1",
    invite_code: "abcd1234",
    member_count: 5,
    created_at: "2025-01-01T00:00:00.000Z",
};

const memberRow = {
    user_id: "u2",
    username: "bob",
    avatar_url: null,
    role: "member",
    status: "active",
    joined_at: "2025-01-01T00:00:00.000Z",
};

function qr(rows: any[] = [], rowCount?: number) {
    return { rows, rowCount: rowCount ?? rows.length } as any;
}

describe("clan.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Constants
    // ═════════════════════════════════════════════════════════════════════════

    it("CLAN_CREATION_COST is 50", () => {
        expect(CLAN_CREATION_COST).toBe(50);
    });

    // ═════════════════════════════════════════════════════════════════════════
    // createClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("createClan", () => {
        it("returns error when balance is insufficient", async () => {
            mockGetBalance.mockResolvedValue(10);

            const result = await createClan("u1", { name: "Test" });
            expect("error" in result).toBe(true);
        });

        it("returns error when balance is null (guest)", async () => {
            mockGetBalance.mockResolvedValue(null);

            const result = await createClan("u1", { name: "Test" });
            expect("error" in result).toBe(true);
        });

        it("returns error when user already owns a clan", async () => {
            mockGetBalance.mockResolvedValue(100);
            mockQuery.mockResolvedValueOnce(qr([{}], 1)); // existing clan owner check

            const result = await createClan("u1", { name: "Test" });
            expect("error" in result).toBe(true);
        });

        it("returns error when name is too short", async () => {
            mockGetBalance.mockResolvedValue(100);
            mockQuery.mockResolvedValueOnce(qr()); // no existing clan

            const result = await createClan("u1", { name: "A" });
            expect("error" in result).toBe(true);
        });

        it("returns error when name is too long", async () => {
            mockGetBalance.mockResolvedValue(100);
            mockQuery.mockResolvedValueOnce(qr());

            const result = await createClan("u1", { name: "A".repeat(31) });
            expect("error" in result).toBe(true);
        });

        it("returns error when name is taken", async () => {
            mockGetBalance.mockResolvedValue(100);
            mockQuery
                .mockResolvedValueOnce(qr()) // not owner
                .mockResolvedValueOnce(qr([{}], 1)); // name taken

            const result = await createClan("u1", { name: "Warriors" });
            expect("error" in result).toBe(true);
        });

        it("creates clan, deducts coins, inserts owner member", async () => {
            mockGetBalance.mockResolvedValue(100);
            mockAddCoins.mockResolvedValue(50);
            mockQuery
                .mockResolvedValueOnce(qr()) // not owner
                .mockResolvedValueOnce(qr()) // name not taken
                .mockResolvedValueOnce(qr([clanRow], 1)) // insert clan RETURNING
                .mockResolvedValueOnce(qr()); // insert owner member

            const result = await createClan("u1", { name: "Warriors" });

            expect("clan" in result).toBe(true);
            expect(mockAddCoins).toHaveBeenCalledWith("u1", -CLAN_CREATION_COST);
        });

        // ── Security ────────────────────────────────────────────────────────

        it("uses parameterized queries (no SQL injection)", async () => {
            mockGetBalance.mockResolvedValue(100);
            mockAddCoins.mockResolvedValue(50);
            mockQuery
                .mockResolvedValueOnce(qr())
                .mockResolvedValueOnce(qr())
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr());

            await createClan("u1", { name: "'; DROP TABLE clans;--" });

            for (const call of mockQuery.mock.calls) {
                expect(call[0]).toContain("$");
                expect(call[1]).toBeInstanceOf(Array);
            }
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // getClanById
    // ═════════════════════════════════════════════════════════════════════════

    describe("getClanById", () => {
        it("returns null when not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());

            const result = await getClanById("c-none");
            expect(result).toBeNull();
        });

        it("returns mapped Clan object", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));

            const result = await getClanById("c1");
            expect(result).not.toBeNull();
            expect(result!.id).toBe("c1");
            expect(result!.name).toBe("Warriors");
            expect(result!.ownerId).toBe("u1");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // getClanDetail
    // ═════════════════════════════════════════════════════════════════════════

    describe("getClanDetail", () => {
        it("returns null when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());

            const result = await getClanDetail("c-none");
            expect(result).toBeNull();
        });

        it("returns clan with members array", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1)) // clan
                .mockResolvedValueOnce(qr([memberRow])); // members

            const result = await getClanDetail("c1");
            expect(result).not.toBeNull();
            expect(result!.members).toHaveLength(1);
            expect(result!.members[0].userId).toBe("u2");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // getClanByInviteCode
    // ═════════════════════════════════════════════════════════════════════════

    describe("getClanByInviteCode", () => {
        it("returns null for invalid code", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            expect(await getClanByInviteCode("bad")).toBeNull();
        });

        it("returns clan for valid code", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await getClanByInviteCode("abcd1234");
            expect(result!.inviteCode).toBe("abcd1234");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // listClans
    // ═════════════════════════════════════════════════════════════════════════

    describe("listClans", () => {
        it("returns array of clans", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow]));

            const result = await listClans();
            expect(result).toHaveLength(1);
        });

        it("accepts optional search param", async () => {
            mockQuery.mockResolvedValueOnce(qr([]));

            await listClans("warriors");

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("LIKE"),
                expect.arrayContaining([expect.stringContaining("warriors")]),
            );
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // getUserClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("getUserClan", () => {
        it("returns null when user has no clan", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            expect(await getUserClan("u1")).toBeNull();
        });

        it("returns clan when user is member", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await getUserClan("u1");
            expect(result!.id).toBe("c1");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // joinClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("joinClan", () => {
        it("returns error when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr()); // getClanById
            const result = await joinClan("c-nope", "u1");
            expect("error" in result).toBe(true);
        });

        it("returns error for private clan", async () => {
            mockQuery.mockResolvedValueOnce(qr([{ ...clanRow, join_mode: "private" }], 1));
            const result = await joinClan("c1", "u2");
            expect("error" in result).toBe(true);
        });

        it("returns error when already active member of same clan", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1)) // clan
                .mockResolvedValueOnce(qr([{ clan_id: "c1", status: "active" }], 1)); // existing member

            const result = await joinClan("c1", "u2");
            expect("error" in result).toBe(true);
        });

        it("returns error when already member of another clan", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ clan_id: "other", status: "active" }], 1));

            const result = await joinClan("c1", "u2");
            expect("error" in result).toBe(true);
        });

        it("joins public clan directly", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([{ ...clanRow, join_mode: "public" }], 1))
                .mockResolvedValueOnce(qr()) // no existing
                .mockResolvedValueOnce(qr()); // insert

            const result = await joinClan("c1", "u2");
            expect("status" in result && result.status).toBe("joined");
        });

        it("returns pending for approval clan", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([{ ...clanRow, join_mode: "approval" }], 1))
                .mockResolvedValueOnce(qr())
                .mockResolvedValueOnce(qr());

            const result = await joinClan("c1", "u2");
            expect("status" in result && result.status).toBe("pending");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // joinClanByInvite
    // ═════════════════════════════════════════════════════════════════════════

    describe("joinClanByInvite", () => {
        it("returns error for invalid code", async () => {
            mockQuery.mockResolvedValueOnce(qr()); // getClanByInviteCode

            const result = await joinClanByInvite("bad-code", "u2");
            expect("error" in result).toBe(true);
        });

        it("returns error when already member of another clan", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1)) // getClanByInviteCode
                .mockResolvedValueOnce(qr([{ clan_id: "other", status: "active" }], 1)); // existing

            const result = await joinClanByInvite("abcd1234", "u2");
            expect("error" in result).toBe(true);
        });

        it("joins directly via invite (bypasses join mode)", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr())
                .mockResolvedValueOnce(qr());

            const result = await joinClanByInvite("abcd1234", "u2");
            expect("clan" in result).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // acceptMember / rejectMember
    // ═════════════════════════════════════════════════════════════════════════

    describe("acceptMember", () => {
        it("returns error when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            const result = await acceptMember("c-none", "u2", "u1");
            expect("error" in result).toBe(true);
        });

        it("returns error when actor is not admin/owner", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "member" }], 1));

            const result = await acceptMember("c1", "u2", "u3");
            expect("error" in result).toBe(true);
        });

        it("returns error when actor not in clan", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr());

            const result = await acceptMember("c1", "u2", "outsider");
            expect("error" in result).toBe(true);
        });

        it("accepts pending member as owner", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "owner" }], 1))
                .mockResolvedValueOnce(qr([{ user_id: "u2" }], 1));

            const result = await acceptMember("c1", "u2", "u1");
            expect("ok" in result && result.ok).toBe(true);
        });

        it("returns error when no pending request", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "admin" }], 1))
                .mockResolvedValueOnce(qr()); // no pending

            const result = await acceptMember("c1", "u2", "u1");
            expect("error" in result).toBe(true);
        });
    });

    describe("rejectMember", () => {
        it("returns error when actor is not admin/owner", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "member" }], 1));

            const result = await rejectMember("c1", "u2", "u3");
            expect("error" in result).toBe(true);
        });

        it("deletes pending member as admin", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "admin" }], 1))
                .mockResolvedValueOnce(qr());

            const result = await rejectMember("c1", "u2", "u3");
            expect("ok" in result && result.ok).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // leaveClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("leaveClan", () => {
        it("returns error when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            const result = await leaveClan("c-none", "u2");
            expect("error" in result).toBe(true);
        });

        it("prevents owner from leaving", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await leaveClan("c1", "u1"); // u1 is ownerId
            expect("error" in result).toBe(true);
        });

        it("allows non-owner to leave", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr());

            const result = await leaveClan("c1", "u2");
            expect("ok" in result && result.ok).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // kickMember
    // ═════════════════════════════════════════════════════════════════════════

    describe("kickMember", () => {
        it("returns error when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            const result = await kickMember("c-none", "u2", "u1");
            expect("error" in result).toBe(true);
        });

        it("prevents kicking the owner", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await kickMember("c1", "u1", "u3"); // u1 = ownerId
            expect("error" in result).toBe(true);
        });

        it("returns error when actor is not admin/owner", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "member" }], 1));

            const result = await kickMember("c1", "u2", "u3");
            expect("error" in result).toBe(true);
        });

        it("kicks member as owner", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "owner" }], 1))
                .mockResolvedValueOnce(qr());

            const result = await kickMember("c1", "u2", "u1");
            expect("ok" in result && result.ok).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // updateClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("updateClan", () => {
        it("returns error when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            const result = await updateClan("c-none", "u1", { name: "New" });
            expect("error" in result).toBe(true);
        });

        it("returns error when actor is not the owner", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await updateClan("c1", "u2", { name: "New" });
            expect("error" in result).toBe(true);
        });

        it("validates name length", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await updateClan("c1", "u1", { name: "A" });
            expect("error" in result).toBe(true);
        });

        it("checks name uniqueness", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1)) // getClanById
                .mockResolvedValueOnce(qr([{}], 1)); // name taken

            const result = await updateClan("c1", "u1", { name: "Taken" });
            expect("error" in result).toBe(true);
        });

        it("returns unchanged clan when no fields to update", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));

            const result = await updateClan("c1", "u1", {});
            expect("clan" in result).toBe(true);
        });

        it("updates clan on valid data", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1)) // getClanById
                .mockResolvedValueOnce(qr()) // name not taken
                .mockResolvedValueOnce(qr()) // UPDATE
                .mockResolvedValueOnce(qr([{ ...clanRow, name: "NewName" }], 1)); // getClanById after

            const result = await updateClan("c1", "u1", { name: "NewName" });
            expect("clan" in result).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // updateClanAvatar
    // ═════════════════════════════════════════════════════════════════════════

    describe("updateClanAvatar", () => {
        it("executes UPDATE query", async () => {
            mockQuery.mockResolvedValueOnce(qr());

            await updateClanAvatar("c1", "https://cdn.test.com/avatar.png");

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE clans SET avatar_url"),
                ["https://cdn.test.com/avatar.png", "c1"],
            );
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // deleteClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("deleteClan", () => {
        it("returns error when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            const result = await deleteClan("c-none", "u1");
            expect("error" in result).toBe(true);
        });

        it("returns error when actor is not owner", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await deleteClan("c1", "u2");
            expect("error" in result).toBe(true);
        });

        it("deletes clan as owner", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr());

            const result = await deleteClan("c1", "u1");
            expect("ok" in result && result.ok).toBe(true);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // regenerateInvite
    // ═════════════════════════════════════════════════════════════════════════

    describe("regenerateInvite", () => {
        it("returns error when clan not found", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            const result = await regenerateInvite("c-none", "u1");
            expect("error" in result).toBe(true);
        });

        it("returns error when actor is not owner", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await regenerateInvite("c1", "u2");
            expect("error" in result).toBe(true);
        });

        it("returns new invite code on success", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr());

            const result = await regenerateInvite("c1", "u1");
            expect("inviteCode" in result).toBe(true);
            expect((result as any).inviteCode).toHaveLength(8);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // saveClanMessage / getClanMessages
    // ═════════════════════════════════════════════════════════════════════════

    describe("saveClanMessage", () => {
        it("inserts message and returns it", async () => {
            mockQuery
                .mockResolvedValueOnce(qr()) // INSERT
                .mockResolvedValueOnce(qr([{ username: "alice", avatar_url: null }])); // user lookup

            const msg = await saveClanMessage("c1", "u1", "Hello!");

            expect(msg.clanId).toBe("c1");
            expect(msg.userId).toBe("u1");
            expect(msg.message).toBe("Hello!");
            expect(msg.username).toBe("alice");
        });

        it("truncates messages to 500 chars", async () => {
            mockQuery
                .mockResolvedValueOnce(qr())
                .mockResolvedValueOnce(qr([{ username: "alice", avatar_url: null }]));

            const longMsg = "x".repeat(600);
            const msg = await saveClanMessage("c1", "u1", longMsg);

            expect(msg.message.length).toBe(500);
        });
    });

    describe("getClanMessages", () => {
        it("returns mapped messages in chronological order", async () => {
            mockQuery.mockResolvedValueOnce(qr([
                { id: "m1", clan_id: "c1", user_id: "u1", username: "alice", avatar_url: null, message: "Hello", created_at: "2025-01-01T00:00:00.000Z" },
                { id: "m2", clan_id: "c1", user_id: "u2", username: "bob", avatar_url: null, message: "Hi", created_at: "2025-01-01T00:01:00.000Z" },
            ]));

            const msgs = await getClanMessages("c1");
            // reverse() is applied, so we check chronological order
            expect(msgs).toHaveLength(2);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // isClanMember
    // ═════════════════════════════════════════════════════════════════════════

    describe("isClanMember", () => {
        it("returns true when user is active member", async () => {
            mockQuery.mockResolvedValueOnce(qr([{}], 1));
            expect(await isClanMember("c1", "u1")).toBe(true);
        });

        it("returns false when user is not member", async () => {
            mockQuery.mockResolvedValueOnce(qr());
            expect(await isClanMember("c1", "u-out")).toBe(false);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Security: Authorization checks
    // ═════════════════════════════════════════════════════════════════════════

    describe("authorization security", () => {
        it("only owner can delete clan", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await deleteClan("c1", "not-owner");
            expect("error" in result).toBe(true);
        });

        it("only owner can regenerate invite", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await regenerateInvite("c1", "not-owner");
            expect("error" in result).toBe(true);
        });

        it("only owner can update clan", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await updateClan("c1", "not-owner", { name: "Hacked" });
            expect("error" in result).toBe(true);
        });

        it("only admin/owner can accept members", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "member" }], 1));

            const result = await acceptMember("c1", "u2", "regular-member");
            expect("error" in result).toBe(true);
        });

        it("only admin/owner can kick members", async () => {
            mockQuery
                .mockResolvedValueOnce(qr([clanRow], 1))
                .mockResolvedValueOnce(qr([{ role: "member" }], 1));

            const result = await kickMember("c1", "u2", "regular-member");
            expect("error" in result).toBe(true);
        });

        it("cannot kick the owner", async () => {
            mockQuery.mockResolvedValueOnce(qr([clanRow], 1));
            const result = await kickMember("c1", "u1", "admin-user"); // u1 is owner
            expect("error" in result).toBe(true);
        });
    });
});
