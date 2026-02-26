import puppeteer, { type Browser, type Page, type ConsoleMessage } from "puppeteer"
import { inject, beforeAll, afterAll, afterEach } from "vitest"

export interface ExtensionContext {
    browser: Browser
    extensionId: string
    page: Page
    consoleErrors: string[]
    pageErrors: Error[]
}

export function useExtension(): ExtensionContext {
    const ctx: ExtensionContext = {
        browser: null!,
        extensionId: "",
        page: null!,
        consoleErrors: [],
        pageErrors: [],
    }

    beforeAll(async () => {
        const wsEndpoint = inject("wsEndpoint")
        ctx.extensionId = inject("extensionId")
        ctx.browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint })
    })

    afterAll(async () => {
        ctx.browser.disconnect()
    })

    afterEach(async () => {
        const pages = await ctx.browser.pages()
        for (const p of pages) {
            if (p !== pages[0]) {
                await p.close()
            }
        }
    })

    return ctx
}

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

    ctx.page = page
    return page
}

/** Wait for Vue hash router to reach the expected hash. */
export async function waitForHash(
    page: Page,
    expectedHash: string,
    timeout = 30_000
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
