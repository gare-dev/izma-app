// ─── API Client ─────────────────────────────────────────────────────────────
// Centralises all REST calls to the server.

import type {
    RegisterDTO,
    LoginDTO,
    GuestDTO,
    AuthResponse,
    PublicUser,
    UpdateProfileDTO,
    Game,
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
    token?: string | null,
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${getBaseUrl()}${path}`, {
        ...options,
        headers,
        credentials: "include", // for refresh-token cookie
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

export async function apiLogout(token: string): Promise<void> {
    await request<{ ok: boolean }>("/auth/logout", { method: "POST" }, token);
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function apiGetMe(token: string): Promise<PublicUser> {
    return request<PublicUser>("/users/me", {}, token);
}

export async function apiUpdateMe(token: string, dto: UpdateProfileDTO): Promise<PublicUser> {
    return request<PublicUser>(
        "/users/me",
        { method: "PATCH", body: JSON.stringify(dto) },
        token,
    );
}

// ─── Games ──────────────────────────────────────────────────────────────────

export async function apiGetGames(): Promise<Game[]> {
    return request<Game[]>("/games");
}
