import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        include: ["tests/e2e/**/*.test.ts"],
        environment: "node",
        globalSetup: "./tests/e2e/global-setup.ts",
        testTimeout: 60_000,
        hookTimeout: 60_000,
        fileParallelism: false,
    },
})
