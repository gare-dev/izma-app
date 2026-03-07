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
