import { describe, it, expect } from "vitest";
import {
    jsonResponse,
    errorResponse,
    corsPreflightResponse,
    parseJsonBody,
} from "../src/utils/http";

describe("jsonResponse", () => {
    it("returns 200 with JSON body by default", async () => {
        const res = jsonResponse({ ok: true });

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("application/json");
        expect(await res.json()).toEqual({ ok: true });
    });

    it("uses custom status code", async () => {
        const res = jsonResponse({ created: true }, 201);
        expect(res.status).toBe(201);
    });

    it("sets CORS headers", () => {
        const res = jsonResponse({});
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
        expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    });

    it("serialises arrays and nested objects", async () => {
        const data = { items: [1, 2, 3], nested: { a: "b" } };
        const res = jsonResponse(data);
        expect(await res.json()).toEqual(data);
    });
});

describe("errorResponse", () => {
    it("returns error body with statusCode, error and message", async () => {
        const res = errorResponse(400, "Campo inválido");
        const body = (await res.json()) as any;

        expect(res.status).toBe(400);
        expect(body.statusCode).toBe(400);
        expect(body.error).toBe("Bad Request");
        expect(body.message).toBe("Campo inválido");
    });

    it('returns "Internal Server Error" for 5xx codes', async () => {
        const res = errorResponse(500, "Algo deu errado");
        const body = (await res.json()) as any;

        expect(body.error).toBe("Internal Server Error");
    });

    it('returns "Bad Request" for 4xx codes', async () => {
        const res = errorResponse(422, "Validação falhou");
        const body = (await res.json()) as any;

        expect(body.error).toBe("Bad Request");
    });
});

describe("corsPreflightResponse", () => {
    it("returns 204 with no body", async () => {
        const res = corsPreflightResponse();

        expect(res.status).toBe(204);
        expect(await res.text()).toBe("");
    });

    it("sets all required CORS headers", () => {
        const res = corsPreflightResponse();

        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
        expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
        expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    });
});

describe("parseJsonBody", () => {
    it("parses valid JSON body", async () => {
        const req = new Request("http://test.local", {
            method: "POST",
            body: JSON.stringify({ name: "test" }),
            headers: { "Content-Type": "application/json" },
        });

        const result = await parseJsonBody<{ name: string }>(req);
        expect(result).toEqual({ name: "test" });
    });

    it("returns null for invalid JSON", async () => {
        const req = new Request("http://test.local", {
            method: "POST",
            body: "not-json",
        });

        const result = await parseJsonBody(req);
        expect(result).toBeNull();
    });

    it("returns null for empty body", async () => {
        const req = new Request("http://test.local", { method: "GET" });

        const result = await parseJsonBody(req);
        expect(result).toBeNull();
    });
});
