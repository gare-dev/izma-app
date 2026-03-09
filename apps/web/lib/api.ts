// ─── API Client ─────────────────────────────────────────────────────────────
// Centralises all REST calls to the server.
// Auth tokens are handled via HttpOnly cookies — no token params needed.

import type {
    RegisterDTO,
    LoginDTO,
    GuestDTO,
    AuthResponse,
    PublicUser,
    UpdateProfileDTO,
    Game,
    PublicRoomInfo,
    ApiError,
    RankingsResponse,
    RankingPeriod,
    Clan,
    ClanDetail,
    PublicClanInfo,
    CreateClanDTO,
    UpdateClanDTO,
    ClanChatMessage,
    MatchSummary,
} from "@izma/types";

function getBaseUrl(): string {
    if (typeof window === "undefined") return "";
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (base) return base;
    const host =
        process.env.NODE_ENV === "development"
            ? `${window.location.hostname}:5051`
            : window.location.host;
    return `${window.location.protocol}//${host}/api`;
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
    };

    const res = await fetch(`${getBaseUrl()}${path}`, {
        ...options,
        headers,
        credentials: "include",
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.message ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function apiRegister(dto: RegisterDTO): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(dto),
    });
}

export async function apiLogin(dto: LoginDTO): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(dto),
    });
}

export async function apiGuest(dto: GuestDTO): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/guest", {
        method: "POST",
        body: JSON.stringify(dto),
    });
}

export async function apiRefreshToken(): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/refresh", { method: "POST" });
}

export async function apiLogout(): Promise<void> {
    await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function apiGetMe(): Promise<PublicUser> {
    return request<PublicUser>("/users/me");
}

export async function apiUpdateMe(dto: UpdateProfileDTO): Promise<PublicUser> {
    return request<PublicUser>(
        "/users/me",
        { method: "PATCH", body: JSON.stringify(dto) },
    );
}

export async function apiUploadAvatar(file: File): Promise<PublicUser> {
    const form = new FormData();
    form.append("avatar", file);

    const res = await fetch(`${getBaseUrl()}/users/me/avatar`, {
        method: "POST",
        body: form,
        credentials: "include",
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.message ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<PublicUser>;
}

// ─── Games ──────────────────────────────────────────────────────────────────

export async function apiGetGames(): Promise<Game[]> {
    return request<Game[]>("/games");
}

// ─── Rooms ──────────────────────────────────────────────────────────────────

export async function apiGetPublicRooms(): Promise<PublicRoomInfo[]> {
    return request<PublicRoomInfo[]>("/rooms");
}

// ─── Rankings ───────────────────────────────────────────────────────────────

export async function apiGetTopCoins(): Promise<RankingsResponse> {
    return request<RankingsResponse>("/rankings/coins");
}

export async function apiGetTopVictories(period: RankingPeriod = "all"): Promise<RankingsResponse> {
    return request<RankingsResponse>(`/rankings/victories?period=${period}`);
}

// ─── Clans ──────────────────────────────────────────────────────────────────

export async function apiListClans(search?: string): Promise<PublicClanInfo[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<PublicClanInfo[]>(`/clans${qs}`);
}

export async function apiGetClan(id: string): Promise<ClanDetail> {
    return request<ClanDetail>(`/clans/${id}`);
}

export async function apiGetMyClan(): Promise<ClanDetail | null> {
    return request<ClanDetail | null>("/clans/me");
}

export async function apiCreateClan(dto: CreateClanDTO): Promise<Clan> {
    return request<Clan>("/clans", {
        method: "POST",
        body: JSON.stringify(dto),
    });
}

export async function apiUpdateClan(id: string, dto: UpdateClanDTO): Promise<Clan> {
    return request<Clan>(`/clans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dto),
    });
}

export async function apiDeleteClan(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/clans/${id}`, { method: "DELETE" });
}

export async function apiJoinClan(id: string): Promise<{ status: "joined" | "pending" }> {
    return request<{ status: "joined" | "pending" }>(`/clans/${id}/join`, { method: "POST" });
}

export async function apiJoinClanByInvite(code: string): Promise<Clan> {
    return request<Clan>(`/clans/invite/${code}`, { method: "POST" });
}

export async function apiLeaveClan(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/clans/${id}/leave`, { method: "POST" });
}

export async function apiAcceptMember(clanId: string, userId: string): Promise<void> {
    await request<{ ok: boolean }>(`/clans/${clanId}/members/${userId}/accept`, { method: "POST" });
}

export async function apiRejectMember(clanId: string, userId: string): Promise<void> {
    await request<{ ok: boolean }>(`/clans/${clanId}/members/${userId}/reject`, { method: "POST" });
}

export async function apiKickMember(clanId: string, userId: string): Promise<void> {
    await request<{ ok: boolean }>(`/clans/${clanId}/members/${userId}/kick`, { method: "POST" });
}

export async function apiRegenerateInvite(clanId: string): Promise<{ inviteCode: string }> {
    return request<{ inviteCode: string }>(`/clans/${clanId}/invite`, { method: "POST" });
}

export async function apiUploadClanAvatar(clanId: string, file: File): Promise<Clan> {
    const form = new FormData();
    form.append("avatar", file);

    const res = await fetch(`${getBaseUrl()}/clans/${clanId}/avatar`, {
        method: "POST",
        body: form,
        credentials: "include",
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.message ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<Clan>;
}

export async function apiGetClanMessages(clanId: string): Promise<ClanChatMessage[]> {
    return request<ClanChatMessage[]>(`/clans/${clanId}/messages`);
}

// ─── Match History ──────────────────────────────────────────────────────────

export async function apiGetMyMatches(limit = 20, offset = 0): Promise<MatchSummary[]> {
    return request<MatchSummary[]>(`/matches/me?limit=${limit}&offset=${offset}`);
}
