import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"

test("sessions remain visible when walletConnect is disabled", async ({ dappConnectedExtension }) => {
    const ctx = dappConnectedExtension
    const page = await openPopup(ctx)
    await waitForHash(page, "#/popup/general")

    // Navigate to sessions page
    await page.goto(
        `chrome-extension://${ctx.extensionId}/src/popup/index.html#/popup/settings/general/sessions`,
        { waitUntil: "domcontentloaded" }
    )
    await waitForHash(page, "#/popup/settings/general/sessions")

    // Assert session is visible
    await page.waitForSelector("text/Aztec Wallet v4 Test", { visible: true, timeout: 10_000 })

    // Disable WalletConnect via the settings UI toggle
    await page.goto(
        `chrome-extension://${ctx.extensionId}/src/popup/index.html#/popup/settings/external-services`,
        { waitUntil: "domcontentloaded" }
    )
    await waitForHash(page, "#/popup/settings/external-services")

    // Find the WalletConnect label, then click its sibling Toggle element
    await page.waitForSelector("text/WalletConnect", { visible: true, timeout: 10_000 })
    await page.evaluate(() => {
        const spans = [...document.querySelectorAll("span")]
        const wcLabel = spans.find((s) => s.textContent === "WalletConnect")
        // Structure: Flex(row) > [Flex(column > Text "WalletConnect"), Toggle(div)]
        // Go up to the row, then click the last child (the toggle wrapper)
        const row = wcLabel!.parentElement!.parentElement!
        const toggle = row.lastElementChild as HTMLElement
        toggle.click()
    })

    // Clear errors from navigation (benign unmount errors)
    ctx.consoleErrors = []
    ctx.pageErrors = []

    // Navigate back to sessions page
    await page.goto(
        `chrome-extension://${ctx.extensionId}/src/popup/index.html#/popup/settings/general/sessions`,
        { waitUntil: "domcontentloaded" }
    )
    await waitForHash(page, "#/popup/settings/general/sessions")

    // Assert session is STILL visible after disabling WalletConnect
    await page.waitForSelector("text/Aztec Wallet v4 Test", { visible: true, timeout: 10_000 })

    // Assert "Connect new Dapp" button is NOT visible when disabled
    const connectBtnVisible = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("button")]
        return buttons.some((b) => b.textContent?.includes("Connect new Dapp"))
    })
    expect(connectBtnVisible).toBe(false)

    expect(ctx.consoleErrors).toEqual([])
    expect(ctx.pageErrors).toEqual([])
}, 60_000)
