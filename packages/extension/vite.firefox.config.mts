import { defineConfig } from "vite"
import { crx } from "@crxjs/vite-plugin"

import manifest from "./manifest/manifest.firefox.config"
import viteConfig from "./vite.config"

viteConfig.plugins?.push(
	crx({
		manifest,
		browser: "firefox",
	}),
)

if (!viteConfig.build) {
	viteConfig.build = {}
}

viteConfig.build.outDir = "dist/firefox"

export default defineConfig({
	...viteConfig,
})
