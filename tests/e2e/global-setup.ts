import { fileURLToPath } from "node:url"
import path from "node:path"
import puppeteer, { type Browser } from "puppeteer"
import type { TestProject } from "vitest/node"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = path.resolve(__dirname, "../../dist/chrome")

let browser: Browser

export default async function setup(project: TestProject) {
    browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--window-size=400,600",
        ],
        ignoreDefaultArgs: ["--disable-extensions"],
    })

    // Discover extension ID from service worker target
    const workerTarget = await browser.waitForTarget(
        (target) =>
            target.type() === "service_worker" &&
            target.url().includes("service-worker-loader"),
        { timeout: 30_000 }
    )
    const extensionId = new URL(workerTarget.url()).hostname

    // Wait for the service worker to fully initialize (config + WASM + services.start).
    // The SW writes a heartbeat to chrome.storage.session once services are running.
    // We poll from an extension page since chrome.storage isn't accessible via SW evaluate.
    const pages = await browser.pages()
    const blankPage = pages[0]
    await blankPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`, {
        waitUntil: "domcontentloaded",
    })
    await blankPage.waitForFunction(
        async () => {
            try {
                const result = await chrome.storage.session.get("azguard:liveness")
                return !!result["azguard:liveness"]
            } catch {
                return false
            }
        },
        { timeout: 60_000, polling: 500 }
    )
    // Close and reopen blank to reset state for tests
    await blankPage.goto("about:blank")

    project.provide("wsEndpoint", browser.wsEndpoint())
    project.provide("extensionId", extensionId)

    return async () => {
        await browser.close()
    }
}

declare module "vitest" {
    export interface ProvidedContext {
        wsEndpoint: string
        extensionId: string
    }
}
