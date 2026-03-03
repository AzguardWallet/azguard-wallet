import puppeteer, { type Browser, type Page, type ConsoleMessage } from "puppeteer"
import { test as base, inject } from "vitest"

export interface ExtensionContext {
    browser: Browser
    extensionId: string
    consoleErrors: string[]
    pageErrors: Error[]
}

/** Launch a fresh browser with the extension and wait for SW liveness. */
async function launchExtension(): Promise<ExtensionContext> {
    const extensionPath = inject("extensionPath")

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
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
        { timeout: 10_000 }
    )
    const extensionId = new URL(workerTarget.url()).hostname

    // Wait for SW to fully initialize (liveness heartbeat in chrome.storage.session)
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
        { timeout: 15_000, polling: 500 }
    )
    await blankPage.goto("about:blank")

    return { browser, extensionId, consoleErrors: [], pageErrors: [] }
}

// ── Fixtures ────────────────────────────────────────────────────────────

export const test = base.extend<{
    /** Fresh browser with extension loaded, no profile. */
    extension: ExtensionContext
    /** Fresh browser with extension + registered profile on #/popup/general. */
    registeredExtension: ExtensionContext
}>({
    extension: [
        async ({}, use) => {
            const ctx = await launchExtension()
            await use(ctx)
            await ctx.browser.close()
        },
        { scope: "file" },
    ],

    registeredExtension: [
        async ({}, use) => {
            const ctx = await launchExtension()
            const page = await openPopup(ctx)

            await waitForHash(page, "#/popup/register")

            const createBtn = await page.waitForSelector("text/Create Profile", { visible: true })
            await createBtn!.click()

            await page.waitForSelector('input[placeholder="Strong password"]', {
                visible: true,
                timeout: 10_000,
            })

            const testPassword = "TestPassword123!"
            await typeIntoInput(page, "Strong password", testPassword)
            await typeIntoInput(page, "Repeat password", testPassword)

            await page.waitForFunction(() => {
                const buttons = [...document.querySelectorAll("button")]
                const btn = buttons.find((b) => b.textContent?.includes("Create with Password"))
                return btn && !btn.disabled
            }, { timeout: 5_000 })

            const submitBtn = await page.waitForSelector("text/Create with Password", { visible: true })
            await submitBtn!.click()

            await waitForHash(page, "#/popup/general", 15_000)
            await page.waitForSelector("text/Account", { visible: true, timeout: 10_000 })
            await page.close()

            await use(ctx)
            await ctx.browser.close()
        },
        { scope: "file" },
    ],
})

// ── Helpers ─────────────────────────────────────────────────────────────

/** Open the extension popup in a new page with error collection. */
export async function openPopup(ctx: ExtensionContext): Promise<Page> {
    const page = await ctx.browser.newPage()
    await page.setViewport({ width: 360, height: 600 })

    ctx.consoleErrors = []
    ctx.pageErrors = []

    page.on("console", (msg: ConsoleMessage) => {
        if (msg.type() === "error") {
            ctx.consoleErrors.push(msg.text())
        }
    })

    page.on("pageerror", (err: Error) => {
        ctx.pageErrors.push(err)
    })

    const popupUrl = `chrome-extension://${ctx.extensionId}/src/popup/index.html`
    await page.goto(popupUrl, { waitUntil: "domcontentloaded" })

    return page
}

/** Wait for Vue hash router to reach the expected hash. */
export async function waitForHash(
    page: Page,
    expectedHash: string,
    timeout = 5_000
): Promise<void> {
    await page.waitForFunction(
        (hash: string) => window.location.hash === hash,
        { timeout },
        expectedHash
    )
}

/** Type into an input found by placeholder. */
export async function typeIntoInput(
    page: Page,
    placeholder: string,
    text: string
): Promise<void> {
    const input = await page.waitForSelector(`input[placeholder="${placeholder}"]`, {
        visible: true,
        timeout: 10_000,
    })
    await input!.click({ clickCount: 3 })
    await input!.type(text)
}
