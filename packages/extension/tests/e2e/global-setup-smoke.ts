import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import type { TestProject } from "vitest/node"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = path.resolve(__dirname, "../../dist/chrome")

/** Smoke test global setup — only validates the extension build exists. No network. */
export default async function setup(project: TestProject) {
	const manifest = path.join(EXTENSION_PATH, "manifest.json")
	if (!fs.existsSync(manifest)) {
		throw new Error(`Extension not found at ${EXTENSION_PATH}\nRun "bun run build" or "bun run dev" first.`)
	}
	project.provide("extensionPath", EXTENSION_PATH)
}

declare module "vitest" {
	export interface ProvidedContext {
		extensionPath: string
	}
}
