import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"

// Skipped: requires local test dApp page (external adhoc-aztec-wallet-test.pages.dev is not under our control)
test.skip("connectDapp fixture establishes a working dapp session", async ({ dappConnectedExtension }) => {
	// Open the popup and verify we're on the general page (profile exists)
	const page = await openPopup(dappConnectedExtension)
	await waitForHash(page, "#/popup/general")
	await page.waitForSelector("text/Account", { visible: true, timeout: 10_000 })

	expect(dappConnectedExtension.consoleErrors).toEqual([])
	expect(dappConnectedExtension.pageErrors).toEqual([])
}, 60_000)
