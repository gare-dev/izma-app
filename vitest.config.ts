import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@izma/types": path.resolve(__dirname, "packages/types/index.ts"),
            "@izma/protocol": path.resolve(__dirname, "packages/protocol/index.ts"),
            "@izma/game-core": path.resolve(__dirname, "packages/game-core/index.ts"),
            "@/": path.resolve(__dirname, "apps/web") + "/",
        },
    },
    test: {
        globals: true,
        include: ["**/__tests__/**/*.test.ts"],
    },
});
