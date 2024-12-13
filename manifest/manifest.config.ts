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
	action: {
		default_popup: "src/popup/index.html#/popup/general",
	},
	background: {
		service_worker: "src/background/index.ts",
		type: "module",
	},
	side_panel: {
		default_path: "src/popup/index.html",
	},
	// content_scripts: [
	// 	{
	// 		all_frames: true,
	// 		js: ["src/content-script/index.ts"],
	// 		matches: ["*://*/*"],
	// 		run_at: "document_end",
	// 	},
	// ],
	options_page: "src/options/index.html",
	offline_enabled: true,
	permissions: ["storage",/* "tabs",*/ "background", "sidePanel"],
	// web_accessible_resources: [
	// 	{
	// 		matches: ["*://*/*"],
	// 		resources: ["src/content-script/index.ts"],
	// 	},
	// 	{
	// 		matches: ["*://*/*"],
	// 		resources: ["src/content-script/iframe/index.html"],
	// 	},
	// ],
	content_security_policy: {
		extension_pages: "script-src 'self' 'wasm-unsafe-eval'",
	},
	icons: {
		16: "src/assets/logo.png",
		24: "src/assets/logo.png",
		32: "src/assets/logo.png",
		128: "src/assets/logo.png",
	},
} as ManifestV3Export
