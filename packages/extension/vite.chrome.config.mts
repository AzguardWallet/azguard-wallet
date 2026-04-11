import { defineConfig } from "vite"
import { crx } from "@crxjs/vite-plugin"

import manifest from "./manifest/manifest.chrome.config"
import viteConfig from "./vite.config"

viteConfig.plugins?.push(
	crx({
		manifest,
		browser: "chrome",
	}),
)

if (!viteConfig.build) {
	viteConfig.build = {}
}

viteConfig.build.outDir = "dist/chrome"

export default defineConfig({
	...viteConfig,
})
