import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		include: ["tests/e2e/*.test.ts"],
		exclude: ["tests/e2e/network/**", "tests/e2e/slow/**"],
		environment: "node",
		globalSetup: "./tests/e2e/global-setup.ts",
		testTimeout: 15_000,
		hookTimeout: 60_000,
		fileParallelism: false,
	},
})
