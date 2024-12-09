import { dirname, relative } from "node:path"
import { fileURLToPath, URL } from "node:url"
import vue from "@vitejs/plugin-vue"
import usePages from "vite-plugin-pages"
import useAutoImport from "unplugin-auto-import/vite"
import useComponents from "unplugin-vue-components/vite"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import { defineViteConfig as define } from "./define.config"

export default defineConfig({
	server: {
		port: 8080,
		strictPort: true,
		hmr: {
			port: 8080,
		},
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"~": fileURLToPath(new URL("./src", import.meta.url)),
			src: fileURLToPath(new URL("./src", import.meta.url)),
			"@assets": fileURLToPath(new URL("src/assets", import.meta.url)),
			// "fs/promises": "node-stdlib-browser/mock/empty",
			"@aztec/bb.js": fileURLToPath(
				new URL("./libs/@aztec/bb.js@0.65.2/dest/browser/index.js", import.meta.url)
			),
			comlink: "comlink",
			debug: "debug",
		},
	},
	css: {
		preprocessorOptions: {
			scss: {
				api: "modern",
			},
		},
	},
	plugins: [
		nodePolyfills({
			globals: {
				Buffer: true,
				global: true,
				process: true,
			},
			exclude: ["fs"],
		}),

		vue(),

		usePages({
			dirs: [
				{
					dir: "src/pages",
					baseRoute: "common",
				},
				{
					dir: "src/setup/pages",
					baseRoute: "setup",
				},
				{
					dir: "src/popup/pages",
					baseRoute: "popup",
				},
				{
					dir: "src/popup/windows",
					baseRoute: "windows",
				},
				{
					dir: "src/options/pages",
					baseRoute: "options",
				},
				{
					dir: "src/content-script/iframe/pages",
					baseRoute: "iframe",
				},
			],
		}),

		useAutoImport({
			imports: [
				"vue",
				"vue-router",
				{
					"webextension-polyfill": [["*", "browser"]],
				},
			],
			dts: "src/types/auto-imports.d.ts",
			dirs: ["src/composables/", "src/stores/", "src/utils/"],
			eslintrc: {
				enabled: true,
				filepath: "src/types/.eslintrc-auto-import.json",
			},
		}),

		useComponents({
			dirs: ["src/components"],
			dts: "src/types/components.d.ts",
		}),

		{
			name: "assets-rewrite",
			enforce: "post",
			apply: "build",
			transformIndexHtml(html, { path }) {
				const assetsPath = relative(dirname(path), "/assets").replace(
					/\\/g,
					"/"
				)
				return html.replace(/"\/assets\//g, `"${assetsPath}/`)
			},
		},
	],
	build: {
		target: "esnext",
		rollupOptions: {
			input: {
				iframe: "src/content-script/iframe/index.html",
				popup: "src/popup/index.html",
				setup: "src/setup/index.html",
				options: "src/options/index.html",
			},
		},
	},
	optimizeDeps: {
		include: ["vue", "webextension-polyfill"],
		exclude: ["vue-demi", "@aztec/bb.js", "@aztec/noir-contracts.js"],
		esbuildOptions: {
			target: "esnext",
		},
	},
	define,
})
