import { inject, expect } from "vitest"
import { test, openPopup, waitForHash } from "../fixtures/extension"
import {
	createAccount,
	switchAccount,
	getAccountAddress,
	sendTransfer,
	waitForTxConfirmation,
	importToken,
	refreshBalances,
	waitForBalance,
} from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

// TODO: Fix account switching — data-testid="account-item" is on a SettingItem (router-link <a>)
// which doesn't respond to page.evaluate click (same issue as navigateToTokenDetail).
// Need to use dispatchEvent or Puppeteer native click with scroll handling.
test.skip("transfer tokens between two accounts", { timeout: 300_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	// Create a second account (auto-switches to it)
	await createAccount(page, "Account 2")
	console.log("✓ Account 2 created")

	// We're now on Account 2 — get its address
	await new Promise((r) => setTimeout(r, 1_000))
	const account2Address = await getAccountAddress(page)
	console.log(`[multi-account] Account 2 address: ${account2Address}`)

	// Switch back to the original account (Account 1)
	// The first account name is auto-generated as "Account 1" by the extension
	await page.evaluate(() => {
		;(document.querySelector('[data-testid="account-selector"]') as HTMLElement)?.click()
	})
	await new Promise((r) => setTimeout(r, 500))
	// Click the first account item (not Account 2)
	await page.evaluate(() => {
		const items = document.querySelectorAll('[data-testid="account-item"]')
		// First item is Account 1 (accounts are ordered by creation)
		if (items[0]) (items[0] as HTMLElement).click()
	})
	await new Promise((r) => setTimeout(r, 1_000))

	// Send 10 tokens pub→pub from Account 1 to Account 2
	await sendTransfer(page, {
		fromType: "public",
		toType: "public",
		amount: "10",
		destination: account2Address,
	})
	console.log("✓ Transfer 10 tokens Account 1 → Account 2 submitted")

	await waitForTxConfirmation(page, 60_000)
	console.log("✓ Transfer confirmed")

	// Switch to Account 2
	await page.evaluate(() => {
		;(document.querySelector('[data-testid="account-selector"]') as HTMLElement)?.click()
	})
	await new Promise((r) => setTimeout(r, 500))
	await page.evaluate(() => {
		const items = document.querySelectorAll('[data-testid="account-item"]')
		// Second item is Account 2
		if (items[1]) (items[1] as HTMLElement).click()
	})
	await new Promise((r) => setTimeout(r, 1_000))

	// Import the token on Account 2
	await importToken(page, aztecConfig!.tokenAddress)
	console.log("✓ Token imported on Account 2")

	// Poll for balance — Account 2 should have 10 tokens
	const maxRetries = 20
	for (let i = 0; i < maxRetries; i++) {
		await refreshBalances(page)
		const bodyText = await page.evaluate(() => document.body.innerText)
		if (bodyText.includes("10")) {
			console.log(`[multi-account] Account 2 balance visible after ${i + 1} refresh(es)`)
			break
		}
		if (i === maxRetries - 1) {
			console.warn("[multi-account] Balance not visible after all retries")
		}
		await new Promise((r) => setTimeout(r, 5_000))
	}

	// Verify Account 2 has received tokens (any non-zero amount with "10")
	await waitForBalance(page, "10", 30_000)
	console.log("✓ Account 2 received 10 tokens")

	await page.close()
})
