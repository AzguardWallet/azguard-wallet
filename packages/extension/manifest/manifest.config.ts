import type { ManifestV3Export } from "@crxjs/vite-plugin"
import packageJson from "../package.json"

const { version, name, description, displayName } = packageJson

const [major, minor, patch, label = "0"] = version.replace(/[^\d.-]+/g, "").split(/[.-]/)

export default {
	name: displayName || name,
	description,
	version: `${major}.${minor}.${patch}.${label}`,
	version_name: version,
	manifest_version: 3,
	// TODO: Update host_permissions when new Nulo domain is ready
	host_permissions: ["https://azguardwallet.io/"],
	action: {
		default_popup: "src/popup/index.html#/popup/general",
	},
	background: {
		service_worker: "src/wallet/index.ts",
		type: "module",
	},
	side_panel: {
		default_path: "src/popup/index.html",
	},
	content_scripts: [
		{
			all_frames: true,
			js: ["src/content-script/content.ts"],
			matches: ["*://*/*"],
			run_at: "document_start",
		},
	],
	permissions: ["offscreen", "storage", "sidePanel", "unlimitedStorage"],
	optional_permissions: ["downloads"],
	content_security_policy: {
		extension_pages: "script-src 'self' 'wasm-unsafe-eval'",
	},
	cross_origin_embedder_policy: {
		value: "require-corp",
	},
	cross_origin_opener_policy: {
		value: "same-origin",
	},
	icons: {
		16: "src/assets/logo.png",
		24: "src/assets/logo.png",
		32: "src/assets/logo.png",
		128: "src/assets/logo.png",
	},
	web_accessible_resources: [
		{
			matches: ["*://*/*"],
			resources: ["src/assets/logo.png"],
		},
	],
} as ManifestV3Export
