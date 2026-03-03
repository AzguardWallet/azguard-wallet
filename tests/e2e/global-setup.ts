import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import type { TestProject } from "vitest/node"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = path.resolve(__dirname, "../../dist/chrome")

export default async function setup(project: TestProject) {
    // Guard: ensure extension is built before launching any browsers
    const manifest = path.join(EXTENSION_PATH, "manifest.json")
    if (!fs.existsSync(manifest)) {
        throw new Error(
            `Extension not found at ${EXTENSION_PATH}\n` +
            `Run "yarn build" or "yarn dev" first.`
        )
    }

    project.provide("extensionPath", EXTENSION_PATH)
}

declare module "vitest" {
    export interface ProvidedContext {
        extensionPath: string
    }
}
