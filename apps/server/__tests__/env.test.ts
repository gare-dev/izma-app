import { describe, it, expect } from "vitest";
import { ENV } from "../src/utils/env";

describe("ENV defaults", () => {
    it("has a default PORT of 5051", () => {
        expect(ENV.PORT).toBe(5051);
    });

    it("has a default JWT_SECRET", () => {
        expect(ENV.JWT_SECRET).toBeTruthy();
    });

    it("has a default JWT_EXPIRES_IN of 2h", () => {
        expect(ENV.JWT_EXPIRES_IN).toBe("2h");
    });

    it("has a default REFRESH_EXPIRES_IN of 7d", () => {
        expect(ENV.REFRESH_EXPIRES_IN).toBe("7d");
    });

    it("has a default BCRYPT_ROUNDS of 12", () => {
        expect(ENV.BCRYPT_ROUNDS).toBe(12);
    });

    it("has a default REDIS_URL", () => {
        expect(ENV.REDIS_URL).toBe("redis://localhost:6379");
    });

    it("NODE_ENV reflects current environment", () => {
        // vitest sets NODE_ENV=test; in production it defaults to "development"
        expect(typeof ENV.NODE_ENV).toBe("string");
        expect(ENV.NODE_ENV.length).toBeGreaterThan(0);
    });

    it("has a default RATE_LIMIT_AUTH_PER_MINUTE of 10", () => {
        expect(ENV.RATE_LIMIT_AUTH_PER_MINUTE).toBe(10);
    });
});
