import type { ApiError } from "@izma/types";

// ─── HTTP helpers ───────────────────────────────────────────────────────────

export function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}

export function errorResponse(statusCode: number, message: string): Response {
    const body: ApiError = {
        statusCode,
        error: statusCode >= 500 ? "Internal Server Error" : "Bad Request",
        message,
    };
    return jsonResponse(body, statusCode);
}

export function corsPreflightResponse(): Response {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
        },
    });
}

// ─── Request parsing ────────────────────────────────────────────────────────

export async function parseJsonBody<T>(req: Request): Promise<T | null> {
    try {
        return (await req.json()) as T;
    } catch {
        return null;
    }
}
