import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the API module to prevent actual HTTP calls
vi.mock("@/lib/api", () => ({
    apiRegister: vi.fn(),
    apiLogin: vi.fn(),
    apiGuest: vi.fn(),
    apiLogout: vi.fn(),
    apiGetMe: vi.fn(),
    apiUpdateMe: vi.fn(),
    apiUploadAvatar: vi.fn(),
    apiRefreshToken: vi.fn(),
    apiGetGames: vi.fn().mockResolvedValue([]),
    apiGetPublicRooms: vi.fn().mockResolvedValue([]),
}));

import { useAuthStore } from "../store/useAuthStore";
import { apiLogin, apiRegister, apiGuest, apiLogout, apiGetMe, apiRefreshToken } from "@/lib/api";

const mockLogin = vi.mocked(apiLogin);
const mockRegister = vi.mocked(apiRegister);
const mockGuest = vi.mocked(apiGuest);
const mockLogout = vi.mocked(apiLogout);
const mockGetMe = vi.mocked(apiGetMe);
const mockRefreshToken = vi.mocked(apiRefreshToken);

function resetStore() {
    useAuthStore.setState({
        user: null,
        loading: false,
        error: null,
    });
}

describe("useAuthStore", () => {
    beforeEach(() => {
        resetStore();
        vi.clearAllMocks();
    });

    describe("login", () => {
        it("sets user on successful login", async () => {
            const user = { id: "u1", username: "Alice", avatarUrl: null, bio: null, coins: 0 };
            mockLogin.mockResolvedValue({ user });

            await useAuthStore.getState().login({ username: "Alice", password: "123456" });

            const state = useAuthStore.getState();
            expect(state.user).toEqual(user);
            expect(state.loading).toBe(false);
            expect(state.error).toBeNull();
        });

        it("sets error on failed login", async () => {
            mockLogin.mockRejectedValue(new Error("Credenciais inválidas."));

            await useAuthStore.getState().login({ username: "Alice", password: "wrong" });

            const state = useAuthStore.getState();
            expect(state.user).toBeNull();
            expect(state.loading).toBe(false);
            expect(state.error).toBe("Credenciais inválidas.");
        });

        it("sets loading during login", async () => {
            let resolveLogin: any;
            mockLogin.mockReturnValue(new Promise((r) => { resolveLogin = r; }));

            const loginPromise = useAuthStore.getState().login({ username: "A", password: "B" });
            expect(useAuthStore.getState().loading).toBe(true);

            resolveLogin({ user: { id: "u1", username: "A", avatarUrl: null, bio: null, coins: 0 } });
            await loginPromise;
            expect(useAuthStore.getState().loading).toBe(false);
        });
    });

    describe("register", () => {
        it("sets user on successful register", async () => {
            const user = { id: "u2", username: "Bob", avatarUrl: null, bio: null, coins: 0 };
            mockRegister.mockResolvedValue({ user });

            await useAuthStore.getState().register({ username: "Bob", email: "bob@test.com", password: "secret" });

            expect(useAuthStore.getState().user).toEqual(user);
        });

        it("sets error on failed register", async () => {
            mockRegister.mockRejectedValue(new Error("Username já está em uso."));

            await useAuthStore.getState().register({ username: "Bob", email: "b@t.com", password: "s" });

            expect(useAuthStore.getState().error).toBe("Username já está em uso.");
        });
    });

    describe("loginAsGuest", () => {
        it("sets guest user", async () => {
            const user = { id: "g1", username: "Guest1", avatarUrl: null, bio: null, coins: 0, isGuest: true };
            mockGuest.mockResolvedValue({ user });

            await useAuthStore.getState().loginAsGuest("Guest1");

            expect(useAuthStore.getState().user).toEqual(user);
        });
    });

    describe("logout", () => {
        it("clears user on logout", async () => {
            useAuthStore.setState({ user: { id: "u1", username: "Test", avatarUrl: null, bio: null, coins: 0 } as any });

            await useAuthStore.getState().logout();

            expect(useAuthStore.getState().user).toBeNull();
        });

        it("still clears user even if apiLogout fails", async () => {
            mockLogout.mockRejectedValue(new Error("Network error"));
            useAuthStore.setState({ user: { id: "u1", username: "Test" } as any });

            await useAuthStore.getState().logout();

            expect(useAuthStore.getState().user).toBeNull();
        });
    });

    describe("checkAuth", () => {
        it("sets user from API on success", async () => {
            const user = { id: "u3", username: "Charlie", avatarUrl: null, bio: null, coins: 50 };
            mockGetMe.mockResolvedValue(user as any);

            await useAuthStore.getState().checkAuth();

            expect(useAuthStore.getState().user).toEqual(user);
        });

        it("clears user when not authenticated", async () => {
            mockGetMe.mockRejectedValue(new Error("401"));
            useAuthStore.setState({ user: { id: "u1" } as any });

            await useAuthStore.getState().checkAuth();

            expect(useAuthStore.getState().user).toBeNull();
        });
    });

    describe("refreshToken", () => {
        it("updates user from refresh response", async () => {
            const user = { id: "u4", username: "Dave", avatarUrl: null, bio: null, coins: 10 };
            mockRefreshToken.mockResolvedValue({ user } as any);

            await useAuthStore.getState().refreshToken();

            expect(useAuthStore.getState().user).toEqual(user);
        });

        it("clears user if refresh fails", async () => {
            mockRefreshToken.mockRejectedValue(new Error("expired"));
            useAuthStore.setState({ user: { id: "u1" } as any });

            await useAuthStore.getState().refreshToken();

            expect(useAuthStore.getState().user).toBeNull();
        });
    });

    describe("clearError", () => {
        it("clears the error", () => {
            useAuthStore.setState({ error: "Something bad" });
            useAuthStore.getState().clearError();
            expect(useAuthStore.getState().error).toBeNull();
        });
    });
});
