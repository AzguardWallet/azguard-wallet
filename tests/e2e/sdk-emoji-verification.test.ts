/**
 * E2E: SDK emoji verification window (anti-MITM check).
 *
 * Uses the adhoc test dapp (SDK-based, auto-connects on load, Testnet by default).
 * The dApp establishes an encrypted channel via the Aztec Wallet SDK and shows a
 * 3x3 emoji grid derived from the ECDH verification hash; the wallet must show
 * the SAME grid in its verify window.
 *
 * Dapp URL is configurable via E2E_DAPP_URL (e.g. a local dev server of
 * /adhoc-aztec-wallet-test: `E2E_DAPP_URL=http://localhost:5183/ yarn test:e2e`).
 * Default points at the deployed dapp.
 */
import { expect } from "vitest"
import type { Browser, Page } from "puppeteer"
import { test } from "./fixtures/extension"

const DAPP_URL = process.env.E2E_DAPP_URL ?? "https://adhoc-aztec-wallet-test.pages.dev/"
const DAPP_HOST = new URL(DAPP_URL).host

/** Extracts the 9 verification emojis from a slice of text between two markers. */
function extractEmojis(text: string, startMarker: string, endMarker: string): string[] {
    const start = text.indexOf(startMarker)
    const end = text.indexOf(endMarker, start)
    const slice = text.slice(start + startMarker.length, end === -1 ? undefined : end)
    return slice.match(/\p{Extended_Pictographic}/gu) ?? []
}

/** Polls until no open target matches the URL fragment (window closed). */
async function waitForWindowClosed(browser: Browser, urlFragment: string, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const open = browser.targets().some((t) => t.url().includes(urlFragment))
        if (!open) return
        await new Promise((r) => setTimeout(r, 250))
    }
    throw new Error(`Window matching "${urlFragment}" did not close within ${timeoutMs}ms`)
}

/** Opens the dApp; it auto-connects on load (Testnet is the default network). */
async function openDapp(browser: Browser): Promise<Page> {
    const dappPage = await browser.newPage()
    await dappPage.goto(DAPP_URL, { waitUntil: "domcontentloaded" })
    return dappPage
}

/** Waits for the dApp's verification modal (secure channel up, confirm/reject shown) and returns its 9 emojis. */
async function readDappEmojis(dappPage: Page): Promise<string[]> {
    const grid = await dappPage.waitForSelector(".verify-grid", { timeout: 30_000 })
    const text = (await grid!.evaluate((el) => el.textContent)) ?? ""
    return text.match(/\p{Extended_Pictographic}/gu) ?? []
}

test("fresh connect: wallet verify window shows the same emoji grid as the dApp", async ({ registeredExtension }) => {
    const { browser } = registeredExtension

    // Watch for the wallet's connect approval window BEFORE the dApp auto-connects
    const connectTargetPromise = browser.waitForTarget(
        (t) => t.url().includes("#/windows/connect"),
        { timeout: 30_000 },
    )

    const dappPage = await openDapp(browser)

    // Approve the connection request (SDK source: no account selection required).
    // Check "Remember this app" so the next test exercises the auto-approve path.
    const connectPage = await (await connectTargetPromise).asPage()
    await connectPage.waitForSelector("text/Connection request", { visible: true, timeout: 15_000 })
    const remember = await connectPage.waitForSelector("text/Remember this app", { visible: true })
    await remember!.click()
    const approveBtn = await connectPage.waitForSelector("text/Approve", { visible: true })
    await approveBtn!.click()

    // The dApp establishes the secure channel and shows its emoji verification modal
    const dappEmojis = await readDappEmojis(dappPage)
    expect(dappEmojis).toHaveLength(9)

    // The wallet verify window opens on session establishment
    const verifyTarget = await browser.waitForTarget(
        (t) => t.url().includes("#/windows/verify"),
        { timeout: 15_000 },
    )
    const verifyPage = await verifyTarget.asPage()
    await verifyPage.waitForSelector("text/Verify connection", { visible: true, timeout: 10_000 })

    // The dApp origin must be displayed (trust anchor)
    const verifyText = await verifyPage.evaluate(() => document.body.innerText)
    expect(verifyText).toContain(DAPP_HOST)

    // Core assertion: both grids derive from the same ECDH verification hash
    const walletEmojis = extractEmojis(verifyText, DAPP_HOST, "Compare these emojis")
    expect(walletEmojis).toHaveLength(9)
    expect(walletEmojis).toEqual(dappEmojis)

    // "They match" closes the window and leaves the session intact
    const matchBtn = await verifyPage.waitForSelector("text/They match", { visible: true })
    await matchBtn!.click()
    await waitForWindowClosed(browser, "#/windows/verify")

    // The dApp is still awaiting its own confirmation — session not terminated
    const confirmBtn = await dappPage.waitForSelector("#btn-verify-confirm", { visible: true })
    await confirmBtn!.click()

    // After dApp-side confirm the session is fully established
    await dappPage.waitForFunction(
        () => document.querySelector(".wallet-status")?.textContent?.includes("disconnect"),
        { timeout: 10_000 },
    )

    await dappPage.close()
}, 90_000)

test("remembered reconnect: no connect popup, verify window auto-closes on first dApp message", async ({ registeredExtension }) => {
    const { browser } = registeredExtension

    // Track whether a connect popup appears at any point — it must NOT (auto-approve)
    let connectPopupSeen = false
    const onTarget = (t: { url(): string }) => {
        if (t.url().includes("#/windows/connect")) connectPopupSeen = true
    }
    browser.on("targetcreated", onTarget)

    try {
        const dappPage = await openDapp(browser)

        // Channel established silently; both emoji surfaces appear with a NEW grid
        const dappEmojis = await readDappEmojis(dappPage)
        const verifyTarget = await browser.waitForTarget(
            (t) => t.url().includes("#/windows/verify"),
            { timeout: 15_000 },
        )
        const verifyPage = await verifyTarget.asPage()
        await verifyPage.waitForSelector("text/Verify connection", { visible: true, timeout: 10_000 })
        const verifyText = await verifyPage.evaluate(() => document.body.innerText)
        const walletEmojis = extractEmojis(verifyText, DAPP_HOST, "Compare these emojis")
        expect(walletEmojis).toEqual(dappEmojis)

        expect(connectPopupSeen).toBe(false)

        // Confirm on the dApp side — purely local, the wallet verify window must stay open
        const confirmBtn = await dappPage.waitForSelector("#btn-verify-confirm", { visible: true })
        await confirmBtn!.click()

        // Send the dApp's first post-connect message WITHOUT touching the wallet window:
        // requestCapabilities (read-only) must auto-close the verify window.
        // The Permissions section is expanded by default; the button is disabled
        // until the session is confirmed.
        await dappPage.waitForFunction(() => {
            const btn = document.querySelector<HTMLButtonElement>("#btn-cap-read")
            return btn && btn.offsetParent !== null && !btn.disabled
        }, { timeout: 10_000 })
        await dappPage.click("#btn-cap-read")

        await waitForWindowClosed(browser, "#/windows/verify")

        // The handoff continues into the capabilities approval window
        await browser.waitForTarget(
            (t) => t.url().includes("#/windows/capabilities"),
            { timeout: 15_000 },
        )

        await dappPage.close()
    } finally {
        browser.off("targetcreated", onTarget)
    }
}, 90_000)

test("reject: dApp-side ✗ reject cancels the session and closes the wallet verify window", async ({ registeredExtension }) => {
    const { browser } = registeredExtension

    const dappPage = await openDapp(browser)

    // Remembered app → channel established silently, pending grid shown
    const dappEmojis = await readDappEmojis(dappPage)
    expect(dappEmojis).toHaveLength(9)

    // The wallet verify window opens for the new session
    const verifyTarget = await browser.waitForTarget(
        (t) => t.url().includes("#/windows/verify"),
        { timeout: 15_000 },
    )
    const verifyPage = await verifyTarget.asPage()
    await verifyPage.waitForSelector("text/Verify connection", { visible: true, timeout: 10_000 })

    // Reject on the dApp side — pending.cancel() sends DISCONNECT to the wallet
    const rejectBtn = await dappPage.waitForSelector("#btn-verify-reject", { visible: true })
    await rejectBtn!.click()

    // dApp tears the session down and returns to the disconnected state
    await dappPage.waitForFunction(
        () => document.body.innerText.includes("Emoji verification rejected"),
        { timeout: 10_000 },
    )
    await dappPage.waitForFunction(
        () => document.querySelector(".wallet-status button")?.textContent === "connect",
        { timeout: 10_000 },
    )

    // The wallet must close the now-orphaned verify window
    await waitForWindowClosed(browser, "#/windows/verify")

    await dappPage.close()
}, 90_000)
