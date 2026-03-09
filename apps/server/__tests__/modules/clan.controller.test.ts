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

vi.mock("../../src/modules/clans/clan.service.ts", () => ({
    createClan: vi.fn(),
    getClanDetail: vi.fn(),
    getClanById: vi.fn(),
    listClans: vi.fn(),
    getUserClan: vi.fn(),
    joinClan: vi.fn(),
    joinClanByInvite: vi.fn(),
    acceptMember: vi.fn(),
    rejectMember: vi.fn(),
    leaveClan: vi.fn(),
    kickMember: vi.fn(),
    updateClan: vi.fn(),
    updateClanAvatar: vi.fn(),
    deleteClan: vi.fn(),
    regenerateInvite: vi.fn(),
    getClanMessages: vi.fn(),
    isClanMember: vi.fn(),
}));

vi.mock("../../src/supabase.ts", () => ({
    supabase: {
        storage: {
            from: vi.fn().mockReturnValue({
                upload: vi.fn().mockResolvedValue({ error: null }),
                getPublicUrl: vi.fn().mockReturnValue({
                    data: { publicUrl: "https://cdn.test.com/clan-avatars/c1/avatar.png" },
                }),
            }),
        },
    },
}));

vi.mock("../../src/utils/env.ts", () => ({
    ENV: {
        SUPABASE_URL: "https://cdn.test.com",
    },
}));

import {
    handleCreateClan,
    handleListClans,
    handleGetMyClan,
    handleGetClan,
    handleUpdateClan,
    handleDeleteClan,
    handleJoinClan,
    handleJoinByInvite,
    handleLeaveClan,
    handleAcceptMember,
    handleRejectMember,
    handleKickMember,
    handleRegenerateInvite,
    handleUploadClanAvatar,
    handleGetClanMessages,
} from "../../src/modules/clans/clan.controller";
import {
    createClan,
    getClanDetail,
    getClanById,
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
    getClanMessages,
    isClanMember,
} from "../../src/modules/clans/clan.service";
import type { Request, Response } from "express";

const mockCreateClan = vi.mocked(createClan);
const mockGetClanDetail = vi.mocked(getClanDetail);
const mockGetClanById = vi.mocked(getClanById);
const mockListClans = vi.mocked(listClans);
const mockGetUserClan = vi.mocked(getUserClan);
const mockJoinClan = vi.mocked(joinClan);
const mockJoinByInvite = vi.mocked(joinClanByInvite);
const mockAcceptMember = vi.mocked(acceptMember);
const mockRejectMember = vi.mocked(rejectMember);
const mockLeaveClan = vi.mocked(leaveClan);
const mockKickMember = vi.mocked(kickMember);
const mockUpdateClan = vi.mocked(updateClan);
const mockDeleteClan = vi.mocked(deleteClan);
const mockRegenerateInvite = vi.mocked(regenerateInvite);
const mockGetClanMessages = vi.mocked(getClanMessages);
const mockIsClanMember = vi.mocked(isClanMember);

// ─── Helpers ────────────────────────────────────────────────────────────────

const authCtx = { userId: "u1", username: "alice", isGuest: false };
const guestCtx = { userId: "g1", username: "Guest", isGuest: true };

const clan = {
    id: "c1",
    name: "Warriors",
    bio: null,
    avatarUrl: null,
    joinMode: "public" as const,
    ownerId: "u1",
    inviteCode: "abc123",
    memberCount: 3,
    createdAt: "2025-01-01",
};

function makeReq(overrides: Partial<Request> = {}): Request {
    return {
        auth: authCtx,
        body: {},
        params: {},
        query: {},
        file: undefined,
        ...overrides,
    } as unknown as Request;
}

function makeRes(): Response & { _status: number; _json: unknown } {
    const res: any = {
        _status: 200,
        _json: null,
        status(code: number) {
            res._status = code;
            return res;
        },
        json(body: unknown) {
            res._json = body;
            return res;
        },
    };
    return res;
}

describe("clan.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleCreateClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleCreateClan", () => {
        it("returns 403 for guests", async () => {
            const req = makeReq({ auth: guestCtx } as any);
            const res = makeRes();
            await handleCreateClan(req, res);
            expect(res._status).toBe(403);
        });

        it("returns 400 when name missing", async () => {
            const req = makeReq({ body: {} });
            const res = makeRes();
            await handleCreateClan(req, res);
            expect(res._status).toBe(400);
        });

        it("returns 422 on service error", async () => {
            mockCreateClan.mockResolvedValue({ error: "Moedas insuficientes." });
            const req = makeReq({ body: { name: "Test" } });
            const res = makeRes();
            await handleCreateClan(req, res);
            expect(res._status).toBe(422);
        });

        it("returns 201 on success", async () => {
            mockCreateClan.mockResolvedValue({ clan });
            const req = makeReq({ body: { name: "Warriors" } });
            const res = makeRes();
            await handleCreateClan(req, res);
            expect(res._status).toBe(201);
            expect(res._json).toMatchObject({ id: "c1" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleListClans
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleListClans", () => {
        it("returns list of clans", async () => {
            mockListClans.mockResolvedValue([clan] as any);
            const req = makeReq({ query: {} });
            const res = makeRes();
            await handleListClans(req, res);
            expect(res._json).toHaveLength(1);
        });

        it("passes search query", async () => {
            mockListClans.mockResolvedValue([]);
            const req = makeReq({ query: { search: "war" } });
            const res = makeRes();
            await handleListClans(req, res);
            expect(mockListClans).toHaveBeenCalledWith("war");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleGetMyClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleGetMyClan", () => {
        it("returns null for guests", async () => {
            const req = makeReq({ auth: guestCtx } as any);
            const res = makeRes();
            await handleGetMyClan(req, res);
            expect(res._json).toBeNull();
        });

        it("returns null when user has no clan", async () => {
            mockGetUserClan.mockResolvedValue(null);
            const req = makeReq();
            const res = makeRes();
            await handleGetMyClan(req, res);
            expect(res._json).toBeNull();
        });

        it("returns clan detail", async () => {
            mockGetUserClan.mockResolvedValue(clan as any);
            mockGetClanDetail.mockResolvedValue({ ...clan, members: [] } as any);
            const req = makeReq();
            const res = makeRes();
            await handleGetMyClan(req, res);
            expect(res._json).toMatchObject({ id: "c1" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleGetClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleGetClan", () => {
        it("returns 404 when not found", async () => {
            mockGetClanDetail.mockResolvedValue(null);
            const req = makeReq({ params: { id: "c-none" } });
            const res = makeRes();
            await handleGetClan(req, res);
            expect(res._status).toBe(404);
        });

        it("returns clan detail", async () => {
            mockGetClanDetail.mockResolvedValue({ ...clan, members: [] } as any);
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleGetClan(req, res);
            expect(res._json).toMatchObject({ id: "c1" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleUpdateClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleUpdateClan", () => {
        it("returns 422 on service error", async () => {
            mockUpdateClan.mockResolvedValue({ error: "Not owner" });
            const req = makeReq({ params: { id: "c1" }, body: { name: "New" } });
            const res = makeRes();
            await handleUpdateClan(req, res);
            expect(res._status).toBe(422);
        });

        it("returns updated clan on success", async () => {
            mockUpdateClan.mockResolvedValue({ clan: { ...clan, name: "New" } });
            const req = makeReq({ params: { id: "c1" }, body: { name: "New" } });
            const res = makeRes();
            await handleUpdateClan(req, res);
            expect(res._json).toMatchObject({ name: "New" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleDeleteClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleDeleteClan", () => {
        it("returns 403 on service error", async () => {
            mockDeleteClan.mockResolvedValue({ error: "Not owner" });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleDeleteClan(req, res);
            expect(res._status).toBe(403);
        });

        it("returns ok on success", async () => {
            mockDeleteClan.mockResolvedValue({ ok: true });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleDeleteClan(req, res);
            expect(res._json).toEqual({ ok: true });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleJoinClan
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleJoinClan", () => {
        it("returns 403 for guests", async () => {
            const req = makeReq({ auth: guestCtx, params: { id: "c1" } } as any);
            const res = makeRes();
            await handleJoinClan(req, res);
            expect(res._status).toBe(403);
        });

        it("returns 422 on service error", async () => {
            mockJoinClan.mockResolvedValue({ error: "Already member" });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleJoinClan(req, res);
            expect(res._status).toBe(422);
        });

        it("returns join result on success", async () => {
            mockJoinClan.mockResolvedValue({ status: "joined" });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleJoinClan(req, res);
            expect(res._json).toEqual({ status: "joined" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleJoinByInvite
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleJoinByInvite", () => {
        it("returns 403 for guests", async () => {
            const req = makeReq({ auth: guestCtx, params: { code: "abc" } } as any);
            const res = makeRes();
            await handleJoinByInvite(req, res);
            expect(res._status).toBe(403);
        });

        it("returns 422 on invalid invite", async () => {
            mockJoinByInvite.mockResolvedValue({ error: "Invalid" });
            const req = makeReq({ params: { code: "bad" } });
            const res = makeRes();
            await handleJoinByInvite(req, res);
            expect(res._status).toBe(422);
        });

        it("returns clan on success", async () => {
            mockJoinByInvite.mockResolvedValue({ clan });
            const req = makeReq({ params: { code: "abc123" } });
            const res = makeRes();
            await handleJoinByInvite(req, res);
            expect(res._json).toMatchObject({ id: "c1" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleLeaveClan / handleAcceptMember / handleRejectMember / handleKickMember
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleLeaveClan", () => {
        it("returns 422 on error", async () => {
            mockLeaveClan.mockResolvedValue({ error: "Owner can't leave" });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleLeaveClan(req, res);
            expect(res._status).toBe(422);
        });

        it("returns ok on success", async () => {
            mockLeaveClan.mockResolvedValue({ ok: true });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleLeaveClan(req, res);
            expect(res._json).toEqual({ ok: true });
        });
    });

    describe("handleAcceptMember", () => {
        it("returns 422 on error", async () => {
            mockAcceptMember.mockResolvedValue({ error: "No permission" });
            const req = makeReq({ params: { id: "c1", userId: "u2" } });
            const res = makeRes();
            await handleAcceptMember(req, res);
            expect(res._status).toBe(422);
        });

        it("returns ok on success", async () => {
            mockAcceptMember.mockResolvedValue({ ok: true });
            const req = makeReq({ params: { id: "c1", userId: "u2" } });
            const res = makeRes();
            await handleAcceptMember(req, res);
            expect(res._json).toEqual({ ok: true });
        });
    });

    describe("handleRejectMember", () => {
        it("returns ok on success", async () => {
            mockRejectMember.mockResolvedValue({ ok: true });
            const req = makeReq({ params: { id: "c1", userId: "u2" } });
            const res = makeRes();
            await handleRejectMember(req, res);
            expect(res._json).toEqual({ ok: true });
        });
    });

    describe("handleKickMember", () => {
        it("returns ok on success", async () => {
            mockKickMember.mockResolvedValue({ ok: true });
            const req = makeReq({ params: { id: "c1", userId: "u2" } });
            const res = makeRes();
            await handleKickMember(req, res);
            expect(res._json).toEqual({ ok: true });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleRegenerateInvite
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleRegenerateInvite", () => {
        it("returns 403 on error", async () => {
            mockRegenerateInvite.mockResolvedValue({ error: "Not owner" });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleRegenerateInvite(req, res);
            expect(res._status).toBe(403);
        });

        it("returns new code on success", async () => {
            mockRegenerateInvite.mockResolvedValue({ inviteCode: "newcode1" });
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleRegenerateInvite(req, res);
            expect(res._json).toEqual({ inviteCode: "newcode1" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleUploadClanAvatar
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleUploadClanAvatar", () => {
        it("returns 404 when clan not found", async () => {
            mockGetClanById.mockResolvedValue(null);
            const req = makeReq({ params: { id: "c-none" } });
            const res = makeRes();
            await handleUploadClanAvatar(req, res);
            expect(res._status).toBe(404);
        });

        it("returns 403 when not owner", async () => {
            mockGetClanById.mockResolvedValue({ ...clan, ownerId: "other" } as any);
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleUploadClanAvatar(req, res);
            expect(res._status).toBe(403);
        });

        it("returns 400 when no file", async () => {
            mockGetClanById.mockResolvedValue(clan as any);
            const req = makeReq({ params: { id: "c1" }, file: undefined });
            const res = makeRes();
            await handleUploadClanAvatar(req, res);
            expect(res._status).toBe(400);
        });

        it("returns 400 for disallowed MIME type", async () => {
            mockGetClanById.mockResolvedValue(clan as any);
            const req = makeReq({
                params: { id: "c1" },
                file: { mimetype: "application/pdf", buffer: Buffer.from(""), originalname: "x.pdf" } as any,
            });
            const res = makeRes();
            await handleUploadClanAvatar(req, res);
            expect(res._status).toBe(400);
        });

        it("uploads and returns updated clan", async () => {
            mockGetClanById
                .mockResolvedValueOnce(clan as any)
                .mockResolvedValueOnce({ ...clan, avatarUrl: "https://cdn.test.com/avatar.png" } as any);
            vi.mocked(updateClanAvatar).mockResolvedValue(undefined);

            const req = makeReq({
                params: { id: "c1" },
                file: { mimetype: "image/png", buffer: Buffer.from("img"), originalname: "a.png" } as any,
            });
            const res = makeRes();
            await handleUploadClanAvatar(req, res);
            expect(res._json).toMatchObject({ id: "c1" });
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // handleGetClanMessages
    // ═════════════════════════════════════════════════════════════════════════

    describe("handleGetClanMessages", () => {
        it("returns 403 when not a member", async () => {
            mockIsClanMember.mockResolvedValue(false);
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleGetClanMessages(req, res);
            expect(res._status).toBe(403);
        });

        it("returns messages when member", async () => {
            mockIsClanMember.mockResolvedValue(true);
            mockGetClanMessages.mockResolvedValue([]);
            const req = makeReq({ params: { id: "c1" } });
            const res = makeRes();
            await handleGetClanMessages(req, res);
            expect(res._json).toEqual([]);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Security: Guest restrictions
    // ═════════════════════════════════════════════════════════════════════════

    describe("guest security", () => {
        it("guests cannot create clans", async () => {
            const req = makeReq({ auth: guestCtx, body: { name: "Test" } } as any);
            const res = makeRes();
            await handleCreateClan(req, res);
            expect(res._status).toBe(403);
        });

        it("guests cannot join clans", async () => {
            const req = makeReq({ auth: guestCtx, params: { id: "c1" } } as any);
            const res = makeRes();
            await handleJoinClan(req, res);
            expect(res._status).toBe(403);
        });

        it("guests cannot join by invite", async () => {
            const req = makeReq({ auth: guestCtx, params: { code: "abc" } } as any);
            const res = makeRes();
            await handleJoinByInvite(req, res);
            expect(res._status).toBe(403);
        });
    });
});
