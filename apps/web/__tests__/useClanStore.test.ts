import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
    apiGetMyClan: vi.fn(),
    apiListClans: vi.fn(),
    apiGetClan: vi.fn(),
    apiCreateClan: vi.fn(),
    apiUpdateClan: vi.fn(),
    apiDeleteClan: vi.fn(),
    apiJoinClan: vi.fn(),
    apiJoinClanByInvite: vi.fn(),
    apiLeaveClan: vi.fn(),
    apiAcceptMember: vi.fn(),
    apiRejectMember: vi.fn(),
    apiKickMember: vi.fn(),
    apiRegenerateInvite: vi.fn(),
    apiUploadClanAvatar: vi.fn(),
    apiGetClanMessages: vi.fn(),
}));

import { useClanStore } from "../store/useClanStore";
import {
    apiGetMyClan,
    apiListClans,
    apiGetClan,
    apiCreateClan,
    apiUpdateClan,
    apiDeleteClan,
    apiJoinClan,
    apiJoinClanByInvite,
    apiLeaveClan,
    apiAcceptMember,
    apiRejectMember,
    apiKickMember,
    apiRegenerateInvite,
    apiUploadClanAvatar,
    apiGetClanMessages,
} from "@/lib/api";

const mockGetMyClan = vi.mocked(apiGetMyClan);
const mockListClans = vi.mocked(apiListClans);
const mockGetClan = vi.mocked(apiGetClan);
const mockCreateClan = vi.mocked(apiCreateClan);
const mockUpdateClan = vi.mocked(apiUpdateClan);
const mockDeleteClan = vi.mocked(apiDeleteClan);
const mockJoinClan = vi.mocked(apiJoinClan);
const mockJoinByInvite = vi.mocked(apiJoinClanByInvite);
const mockLeaveClan = vi.mocked(apiLeaveClan);
const mockAcceptMember = vi.mocked(apiAcceptMember);
const mockRejectMember = vi.mocked(apiRejectMember);
const mockKickMember = vi.mocked(apiKickMember);
const mockRegenerateInvite = vi.mocked(apiRegenerateInvite);
const mockUploadAvatar = vi.mocked(apiUploadClanAvatar);
const mockGetClanMessages = vi.mocked(apiGetClanMessages);

// ─── Helpers ────────────────────────────────────────────────────────────────

const clan = {
    id: "c1",
    name: "Warriors",
    bio: null,
    avatarUrl: null,
    joinMode: "public" as const,
    ownerId: "u1",
    inviteCode: "abc",
    memberCount: 2,
    createdAt: "2025-01-01",
};

const clanDetail = { ...clan, members: [{ userId: "u1", username: "Alice", role: "owner" as const, status: "active" as const }] };

function resetStore() {
    useClanStore.setState({
        myClan: null,
        clanList: [],
        messages: [],
        loading: false,
        error: null,
        _lastSentAt: [],
    });
}

describe("useClanStore", () => {
    beforeEach(() => {
        resetStore();
        vi.clearAllMocks();
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Data fetching
    // ═══════════════════════════════════════════════════════════════════════

    describe("fetchMyClan", () => {
        it("sets myClan on success", async () => {
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            await useClanStore.getState().fetchMyClan();
            expect(useClanStore.getState().myClan).toMatchObject({ id: "c1" });
            expect(useClanStore.getState().loading).toBe(false);
        });

        it("sets error on failure", async () => {
            mockGetMyClan.mockRejectedValue(new Error("Network error"));
            await useClanStore.getState().fetchMyClan();
            expect(useClanStore.getState().error).toBe("Network error");
            expect(useClanStore.getState().loading).toBe(false);
        });
    });

    describe("fetchClanList", () => {
        it("sets clanList", async () => {
            mockListClans.mockResolvedValue([clan] as any);
            await useClanStore.getState().fetchClanList();
            expect(useClanStore.getState().clanList).toHaveLength(1);
        });

        it("passes search param", async () => {
            mockListClans.mockResolvedValue([]);
            await useClanStore.getState().fetchClanList("war");
            expect(mockListClans).toHaveBeenCalledWith("war");
        });
    });

    describe("fetchClanDetail", () => {
        it("returns clan detail", async () => {
            mockGetClan.mockResolvedValue(clanDetail as any);
            const result = await useClanStore.getState().fetchClanDetail("c1");
            expect(result).toMatchObject({ id: "c1" });
        });

        it("returns null on error", async () => {
            mockGetClan.mockRejectedValue(new Error("Not found"));
            const result = await useClanStore.getState().fetchClanDetail("bad");
            expect(result).toBeNull();
            expect(useClanStore.getState().error).toBe("Not found");
        });
    });

    describe("fetchClanMessages", () => {
        it("sets messages", async () => {
            const msgs = [{ id: "m1", userId: "u1", username: "Alice", message: "Hi", clanId: "c1", timestamp: 1 }];
            mockGetClanMessages.mockResolvedValue(msgs as any);
            await useClanStore.getState().fetchClanMessages("c1");
            expect(useClanStore.getState().messages).toHaveLength(1);
        });

        it("silently ignores errors", async () => {
            mockGetClanMessages.mockRejectedValue(new Error("fail"));
            await useClanStore.getState().fetchClanMessages("c1");
            expect(useClanStore.getState().messages).toEqual([]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Mutations
    // ═══════════════════════════════════════════════════════════════════════

    describe("createClan", () => {
        it("returns clan on success", async () => {
            mockCreateClan.mockResolvedValue(clan as any);
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            const result = await useClanStore.getState().createClan({ name: "Warriors" });
            expect(result).toMatchObject({ id: "c1" });
            expect(useClanStore.getState().loading).toBe(false);
        });

        it("returns null on error", async () => {
            mockCreateClan.mockRejectedValue(new Error("Insufficient coins"));
            const result = await useClanStore.getState().createClan({ name: "Test" });
            expect(result).toBeNull();
            expect(useClanStore.getState().error).toBe("Insufficient coins");
        });
    });

    describe("updateClan", () => {
        it("returns true on success and refetches", async () => {
            mockUpdateClan.mockResolvedValue(clan as any);
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            const ok = await useClanStore.getState().updateClan("c1", { name: "New" });
            expect(ok).toBe(true);
            expect(mockGetMyClan).toHaveBeenCalled();
        });

        it("returns false on error", async () => {
            mockUpdateClan.mockRejectedValue(new Error("Not owner"));
            const ok = await useClanStore.getState().updateClan("c1", { name: "X" });
            expect(ok).toBe(false);
        });
    });

    describe("deleteClan", () => {
        it("clears myClan and messages on success", async () => {
            useClanStore.setState({ myClan: clanDetail as any, messages: [{ id: "m1" }] as any });
            mockDeleteClan.mockResolvedValue(undefined);
            await useClanStore.getState().deleteClan("c1");
            expect(useClanStore.getState().myClan).toBeNull();
            expect(useClanStore.getState().messages).toEqual([]);
        });
    });

    describe("joinClan", () => {
        it("returns 'joined' and refetches myClan", async () => {
            mockJoinClan.mockResolvedValue({ status: "joined" });
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            const status = await useClanStore.getState().joinClan("c1");
            expect(status).toBe("joined");
            expect(mockGetMyClan).toHaveBeenCalled();
        });

        it("returns 'pending' without refetching", async () => {
            mockJoinClan.mockResolvedValue({ status: "pending" });
            const status = await useClanStore.getState().joinClan("c1");
            expect(status).toBe("pending");
            expect(mockGetMyClan).not.toHaveBeenCalled();
        });

        it("returns null on API error", async () => {
            mockJoinClan.mockRejectedValue(new Error("Already in clan"));
            const status = await useClanStore.getState().joinClan("c1");
            expect(status).toBeNull();
        });
    });

    describe("joinByInvite", () => {
        it("returns clan and refetches", async () => {
            mockJoinByInvite.mockResolvedValue(clan as any);
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            const result = await useClanStore.getState().joinByInvite("abc");
            expect(result).toMatchObject({ id: "c1" });
        });

        it("returns null on error", async () => {
            mockJoinByInvite.mockRejectedValue(new Error("Invalid"));
            expect(await useClanStore.getState().joinByInvite("bad")).toBeNull();
        });
    });

    describe("leaveClan", () => {
        it("clears myClan and messages", async () => {
            useClanStore.setState({ myClan: clanDetail as any, messages: [{}] as any });
            mockLeaveClan.mockResolvedValue(undefined);
            await useClanStore.getState().leaveClan("c1");
            expect(useClanStore.getState().myClan).toBeNull();
            expect(useClanStore.getState().messages).toEqual([]);
        });
    });

    describe("member management", () => {
        it("acceptMember calls API and refetches", async () => {
            mockAcceptMember.mockResolvedValue(undefined);
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            await useClanStore.getState().acceptMember("c1", "u2");
            expect(mockAcceptMember).toHaveBeenCalledWith("c1", "u2");
            expect(mockGetMyClan).toHaveBeenCalled();
        });

        it("rejectMember calls API and refetches", async () => {
            mockRejectMember.mockResolvedValue(undefined);
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            await useClanStore.getState().rejectMember("c1", "u2");
            expect(mockRejectMember).toHaveBeenCalledWith("c1", "u2");
        });

        it("kickMember calls API and refetches", async () => {
            mockKickMember.mockResolvedValue(undefined);
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            await useClanStore.getState().kickMember("c1", "u2");
            expect(mockKickMember).toHaveBeenCalledWith("c1", "u2");
        });

        it("sets error when acceptMember fails", async () => {
            mockAcceptMember.mockRejectedValue(new Error("No permission"));
            await useClanStore.getState().acceptMember("c1", "u2");
            expect(useClanStore.getState().error).toBe("No permission");
        });
    });

    describe("regenerateInvite", () => {
        it("returns new invite code", async () => {
            mockRegenerateInvite.mockResolvedValue({ inviteCode: "newcode" });
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            const code = await useClanStore.getState().regenerateInvite("c1");
            expect(code).toBe("newcode");
        });

        it("returns null on error", async () => {
            mockRegenerateInvite.mockRejectedValue(new Error("Not owner"));
            const code = await useClanStore.getState().regenerateInvite("c1");
            expect(code).toBeNull();
        });
    });

    describe("uploadAvatar", () => {
        it("calls API and refetches", async () => {
            mockUploadAvatar.mockResolvedValue(clan as any);
            mockGetMyClan.mockResolvedValue(clanDetail as any);
            await useClanStore.getState().uploadAvatar("c1", new File([""], "a.png"));
            expect(mockUploadAvatar).toHaveBeenCalled();
            expect(mockGetMyClan).toHaveBeenCalled();
        });

        it("sets error on failure", async () => {
            mockUploadAvatar.mockRejectedValue(new Error("Too large"));
            await useClanStore.getState().uploadAvatar("c1", new File([""], "a.png"));
            expect(useClanStore.getState().error).toBe("Too large");
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Chat
    // ═══════════════════════════════════════════════════════════════════════

    describe("sendClanMessage", () => {
        it("returns false when ws is null", () => {
            expect(useClanStore.getState().sendClanMessage(null, "c1", "hi")).toBe(false);
        });

        it("returns false for empty text", () => {
            const ws = { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
            expect(useClanStore.getState().sendClanMessage(ws, "c1", "   ")).toBe(false);
        });

        it("sends JSON over ws and returns true", () => {
            const ws = { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
            expect(useClanStore.getState().sendClanMessage(ws, "c1", "hello")).toBe(true);
            expect(ws.send).toHaveBeenCalledWith(
                expect.stringContaining('"type":"CLAN_CHAT"'),
            );
        });

        it("truncates message to 500 chars", () => {
            const ws = { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
            const longMsg = "a".repeat(600);
            useClanStore.getState().sendClanMessage(ws, "c1", longMsg);
            const sent = JSON.parse((ws.send as any).mock.calls[0][0]);
            expect(sent.payload.message.length).toBeLessThanOrEqual(500);
        });

        it("enforces flood protection", () => {
            const ws = { readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket;
            const store = useClanStore.getState();
            store.sendClanMessage(ws, "c1", "1");
            store.sendClanMessage(ws, "c1", "2");
            store.sendClanMessage(ws, "c1", "3");
            const fourth = useClanStore.getState().sendClanMessage(ws, "c1", "4");
            expect(fourth).toBe(false);
        });
    });

    describe("addChatMessage", () => {
        it("appends message", () => {
            const msg = { id: "m1", userId: "u1", username: "Alice", message: "Hi", clanId: "c1", timestamp: 1 };
            useClanStore.getState().addChatMessage(msg as any);
            expect(useClanStore.getState().messages).toHaveLength(1);
        });

        it("caps at MAX_MESSAGES (200)", () => {
            const msgs = Array.from({ length: 200 }, (_, i) => ({
                id: `m${i}`, userId: "u1", username: "A", message: "x", clanId: "c1", timestamp: i,
            }));
            useClanStore.setState({ messages: msgs as any });
            useClanStore.getState().addChatMessage({
                id: "extra", userId: "u1", username: "A", message: "y", clanId: "c1", timestamp: 999,
            } as any);
            expect(useClanStore.getState().messages.length).toBeLessThanOrEqual(200);
            expect(useClanStore.getState().messages.at(-1)!.id).toBe("extra");
        });
    });

    describe("clearError", () => {
        it("clears the error", () => {
            useClanStore.setState({ error: "Something" });
            useClanStore.getState().clearError();
            expect(useClanStore.getState().error).toBeNull();
        });
    });
});
