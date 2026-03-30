import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"

// Skipped: requires working account creation (blocked by AzguardAccount recompilation)
test.skip("connectDapp fixture establishes a working dapp session", async ({ dappConnectedExtension }) => {
    // Open the popup and verify we're on the general page (profile exists)
    const page = await openPopup(dappConnectedExtension)
    await waitForHash(page, "#/popup/general")
    await page.waitForSelector("text/Account", { visible: true, timeout: 10_000 })

    expect(dappConnectedExtension.consoleErrors).toEqual([])
    expect(dappConnectedExtension.pageErrors).toEqual([])
}, 60_000)
