import { dirname, relative } from "node:path"
import { fileURLToPath, URL } from "node:url"
import vue from "@vitejs/plugin-vue"
import usePages from "vite-plugin-pages"
import useAutoImport from "unplugin-auto-import/vite"
import useComponents from "unplugin-vue-components/vite"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import packageJson from "./package.json"
import { viteStaticCopy } from "vite-plugin-static-copy"

export default defineConfig({
	server: {
		port: 8088,
		strictPort: true,
		hmr: {
			port: 8088,
		},
		// Headers needed for bb WASM to work in multithreaded mode
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin",
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
				new URL("./libs/@aztec/bb.js@0.85.0-alpha-testnet.2/dest/browser/index.js", import.meta.url),
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
				const assetsPath = relative(dirname(path), "/assets").replace(/\\/g, "/")
				return html.replace(/"\/assets\//g, `"${assetsPath}/`)
			},
		},

		{
			name: "wasm-content-type",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					if (req.url?.endsWith(".wasm")) {
						res.setHeader("Content-Type", "application/wasm")
					}
					next()
				})
			},
		},

		viteStaticCopy({
			targets: [
				{
					src: "./node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/*.gz",
					dest: "assets/",
				},
			],
		}),

		{
			...nodePolyfills({
				include: ["buffer", "crypto", "net", "path", "stream", "tty", "vm"],
			}),
			// Unfortunate, but needed due to https://github.com/davidmyersdev/vite-plugin-node-polyfills/issues/81
			// Suspected to be because of the yarn workspace setup, but not sure
			resolveId(source: string) {
				const m = /^vite-plugin-node-polyfills\/shims\/(buffer|global|process)$/.exec(source)
				if (m) {
					return `./node_modules/vite-plugin-node-polyfills/shims/${m[1]}/dist/index.cjs`
				}
			},
		},
	],
	build: {
		target: "esnext",
		rollupOptions: {
			input: {
				popup: "src/popup/index.html",
				setup: "src/setup/index.html",
			},
		},
	},
	optimizeDeps: {
		include: ["vue", "webextension-polyfill"],
		exclude: ["vue-demi", "@aztec/noir-acvm_js", "@aztec/noir-noirc_abi"],
		esbuildOptions: {
			target: "esnext",
		},
	},
	define: {
		__VERSION__: JSON.stringify(packageJson.version),
		__NAME__: JSON.stringify(packageJson.name),
		__DISPLAY_NAME__: JSON.stringify(packageJson.displayName),
		"import.meta.env.HTML_TITLE": JSON.stringify(packageJson.displayName),
		"process.env": JSON.stringify({
			LOG_LEVEL: "verbose",
			BB_WASM_PATH: "/assets/barretenberg.wasm.gz",
		}),
	},
})
