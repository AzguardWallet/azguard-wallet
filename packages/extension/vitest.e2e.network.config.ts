import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		include: ["tests/e2e/network/**/*.test.ts"],
		environment: "node",
		globalSetup: "./tests/e2e/global-setup.ts",
		testTimeout: 30_000,
		hookTimeout: 300_000, // 5min — tokenReadyExtension creates EmbeddedWallet + mints tokens
		fileParallelism: false,
		// Node v24 enforces JSON import attributes; @aztec/accounts imports JSON without them.
		// Use the unstable loader to relax this check in the global setup process.
		server: {
			deps: {
				inline: [/@aztec/],
			},
		},
	},
})
