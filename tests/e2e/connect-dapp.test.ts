import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"

/**
 * DISABLED 2026-06-10: the deployed dapp (adhoc-aztec-wallet-test.pages.dev) is a stale
 * legacy-RPC (window.azguard) build — its connect request uses methods the current wallet
 * no longer accepts (`Invalid method: "aztec_simulateUtility"`), so the approval window
 * never opens. The SDK connect path is covered by sdk-emoji-verification.test.ts.
 * Re-enable once the adhoc dapp is reworked/redeployed (planned: local test dapp).
 */
test.skip("connectDapp fixture establishes a working dapp session", async ({ dappConnectedExtension }) => {
    // Open the popup and verify we're on the general page (profile exists)
    const page = await openPopup(dappConnectedExtension)
    await waitForHash(page, "#/popup/general")
    await page.waitForSelector("text/Account", { visible: true, timeout: 10_000 })

    expect(dappConnectedExtension.consoleErrors).toEqual([])
    expect(dappConnectedExtension.pageErrors).toEqual([])
}, 60_000)
