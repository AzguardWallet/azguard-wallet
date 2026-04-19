import { existsSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath, URL } from "node:url"
import vue from "@vitejs/plugin-vue"

/** Resolve a file inside an npm package, bypassing its `exports` field.
 *  Walks up from this config file to find the package in any node_modules. */
function resolvePackageFile(pkg: string, file: string): string {
	const parts = pkg.startsWith("@") ? pkg.split("/").slice(0, 2) : [pkg.split("/")[0]]
	let dir = fileURLToPath(new URL(".", import.meta.url))
	while (dir !== dirname(dir)) {
		const candidate = join(dir, "node_modules", ...parts, file)
		if (existsSync(candidate)) return candidate
		dir = dirname(dir)
	}
	throw new Error(`Cannot find ${pkg}/${file} in any node_modules`)
}
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
			"@private-fpc-artifact": resolvePackageFile("@wonderland/aztec-fee-payment", "target/private_contract-PrivateFPC.json"),
			"@wonderland-token-artifact": resolvePackageFile(
				"@defi-wonderland/aztec-standards",
				"artifacts/target/token_contract-Token.json",
			),
			"@alejoamiras/aztec-accelerator": resolvePackageFile("@alejoamiras/aztec-accelerator", "dist/index.js"),
			// Force detect-node to return false so @aztec/foundation's pino logger
			// uses the browser transport instead of Node.js worker-thread transport.
			// Without this, the node-polyfills process shim makes detect-node think
			// we're in Node.js, causing pino.transport() to fail with "window is not defined".
			"detect-node": fileURLToPath(new URL("./src/shims/detect-node.ts", import.meta.url)),
			comlink: "comlink",
			debug: "debug",
		},
		// Force Vite to resolve these WASM-binding packages to a single copy.
		// Multiple nested versions exist in node_modules (rc.2 in simulator/pxe,
		// rc.4 hoisted). Without dedup, initAbi() and abiEncode() end up in
		// different module scopes, so the WASM instance variable is never shared.
		dedupe: ["@aztec/noir-noirc_abi", "@aztec/noir-acvm_js"],
	},
	css: {
		preprocessorOptions: {
			scss: {
				loadPaths: [fileURLToPath(new URL("./src/assets/styles", import.meta.url))],
				quietDeps: true,
			},
		},
	},
	plugins: [
		// Replace bb.js fetchCode module to eliminate dynamic import() of embedded WASM.
		// Chrome MV3 service workers forbid import() at runtime. Our shim uses fetch()
		// against the WASM files in /assets/ instead.
		{
			name: "bb-fetch-code-shim",
			enforce: "pre",
			resolveId(source, importer) {
				if (importer?.includes("@aztec/bb.js") && source.includes("fetch_code") && source.endsWith("index.js")) {
					return fileURLToPath(new URL("./src/shims/bb-fetch-code.ts", import.meta.url))
				}
			},
		},
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
			// Rewrites compiled _ctx.<name> template references to resolve against the
			// auto-import registry so {{ trimAddress(...) }} works without explicit
			// imports in every SFC. Plugin runs enforce:"post" internally — must stay
			// after vue() in the plugin chain.
			vueTemplate: true,
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
					src: "./libs/@aztec/bb.js/*.wasm.gz",
					dest: "assets/",
				},
			],
		}),

		nodePolyfills({
			include: ["buffer", /*"crypto",*/ "net", "path", "stream", "tty", "vm", "util"],
		}),
	],
	build: {
		// Disable module preload polyfill — it references `window.dispatchEvent`
		// which doesn't exist in Chrome MV3 service workers.
		modulePreload: false,
		target: "esnext",
		rollupOptions: {
			input: {
				offscreen: "src/offscreen/index.html",
				popup: "src/popup/index.html",
				setup: "src/setup/index.html",
			},
		},
	},
	optimizeDeps: {
		include: ["pino", "vue", "webextension-polyfill"],
		exclude: ["@aztec/bb.js", "@aztec/noir-acvm_js", "@aztec/noir-noirc_abi", "vue-demi"],
		esbuildOptions: {
			target: "esnext",
		},
	},
	define: {
		__VERSION__: JSON.stringify(packageJson.version),
		__SENTINEL__: JSON.stringify(packageJson.sentinel),
		__AZTEC_VERSION__: JSON.stringify(packageJson.dependencies["@aztec/pxe"] ?? "unknown"),
		__NAME__: JSON.stringify(packageJson.name),
		__DISPLAY_NAME__: JSON.stringify(packageJson.displayName),
		"import.meta.env.HTML_TITLE": JSON.stringify(packageJson.displayName),
		"process.browser": true,
		"process.env": JSON.stringify({
			LOG_LEVEL: "verbose",
			BB_WASM_PATH: "/assets/barretenberg.wasm.gz",
		}),
	},
})
