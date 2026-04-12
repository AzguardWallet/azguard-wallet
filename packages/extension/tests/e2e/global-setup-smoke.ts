import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import { execSync } from "node:child_process"
import type { TestProject } from "vitest/node"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = path.resolve(__dirname, "../../dist/chrome")

/** Kill orphan Chromium/Chrome for Testing processes from previous test runs. */
function cleanupOrphanChromeProcesses() {
	try {
		execSync('pkill -f "chrome.*--test-type" 2>/dev/null || true', { stdio: "ignore" })
		execSync('pkill -f "Google Chrome for Testing" 2>/dev/null || true', { stdio: "ignore" })
	} catch {
		// Ignore errors — processes may not exist
	}
}

/** Smoke test global setup — validates the extension build and cleans up stale Chrome processes. */
export default async function setup(project: TestProject) {
	cleanupOrphanChromeProcesses()

	const manifest = path.join(EXTENSION_PATH, "manifest.json")
	if (!fs.existsSync(manifest)) {
		throw new Error(`Extension not found at ${EXTENSION_PATH}\nRun "bun run build" or "bun run dev" first.`)
	}
	project.provide("extensionPath", EXTENSION_PATH)
}

export async function teardown() {
	cleanupOrphanChromeProcesses()
}

declare module "vitest" {
	export interface ProvidedContext {
		extensionPath: string
	}
}
