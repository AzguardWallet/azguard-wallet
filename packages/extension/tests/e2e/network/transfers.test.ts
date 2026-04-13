import { inject, expect } from "vitest"
import { test, openPopup, waitForHash } from "../fixtures/extension"
import { sendTransfer, waitForBalance, waitForTxConfirmation, navigateToTokenDetail, getTokenDetailBalances } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

// All tests share ONE tokenReadyExtension (file-scoped, runs once).
// Tests are SEQUENTIAL and each waits for the previous tx to confirm
// before proceeding. This is required because Aztec uses nullifiers —
// a second tx against stale state will revert.

test.skipIf(!hasConfig)("balance shows minted tokens", { timeout: 120_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")
	await waitForBalance(page, "1,000", 60_000)
	console.log("✓ Initial balance: 1,000 public tokens")
	await page.close()
})

test.skipIf(!hasConfig)("public to public transfer", { timeout: 180_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	await sendTransfer(page, {
		fromType: "public",
		toType: "public",
		amount: "10",
		destination: tokenReadyExtension.accountAddress,
	})
	console.log("✓ Public → Public submitted")

	// Wait for tx to confirm before next test (nullifier tree must settle)
	await waitForTxConfirmation(page, 60_000)
	console.log("✓ Tx confirmed")
	await page.close()
})

test.skipIf(!hasConfig)("public to private transfer (shield)", { timeout: 180_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	await sendTransfer(page, {
		fromType: "public",
		toType: "private",
		amount: "100",
		destination: tokenReadyExtension.accountAddress,
	})
	console.log("✓ Public → Private (shield) submitted")

	// Wait for tx to confirm AND private balance to appear
	await waitForTxConfirmation(page, 60_000)
	console.log("✓ Shield tx confirmed")
	await waitForBalance(page, "Priv", 60_000)
	console.log("✓ Private balance visible")
	await page.close()
})

test.skipIf(!hasConfig)("private to public transfer (unshield)", { timeout: 180_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	await sendTransfer(page, {
		fromType: "private",
		toType: "public",
		amount: "50",
		destination: tokenReadyExtension.accountAddress,
	})
	console.log("✓ Private → Public (unshield) submitted")

	await waitForTxConfirmation(page, 60_000)
	console.log("✓ Unshield tx confirmed")
	await page.close()
})

test.skipIf(!hasConfig)("private to private transfer", { timeout: 180_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	await sendTransfer(page, {
		fromType: "private",
		toType: "private",
		amount: "10",
		destination: tokenReadyExtension.accountAddress,
	})
	console.log("✓ Private → Private submitted")

	await waitForTxConfirmation(page, 60_000)
	console.log("✓ Tx confirmed")
	await page.close()
})

test.skipIf(!hasConfig)("token detail shows correct balances after transfers", { timeout: 120_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToTokenDetail(page)

	const { privateBalance, publicBalance } = await getTokenDetailBalances(page)
	console.log(`Token detail balances — public: "${publicBalance}", private: "${privateBalance}"`)

	expect(publicBalance).toContain("950")
	expect(privateBalance).toContain("50")
	console.log("✓ Token detail balances match expected values (pub=950, priv=50)")
	await page.close()
})

test.skipIf(!hasConfig)("send from token detail page loads token correctly", { timeout: 120_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	// Navigate to token detail page
	await navigateToTokenDetail(page)

	// Click "Send" from the public balance row in SplittedBalancesView
	const sendFromPublic = await page.waitForSelector('[data-testid="send-from-public"]', { visible: true, timeout: 10_000 })
	await sendFromPublic!.scrollIntoView()
	await sendFromPublic!.click()

	// Wait for SendPopup to mount — send-from-type proves the token loaded
	// (if the bug were present, we'd see "No available tokens" instead)
	await page.waitForSelector('[data-testid="send-from-type"]', { timeout: 15_000 })

	// Verify the amount input exists (proves token was selected, not "No available tokens")
	const hasAmountInput = await page.evaluate(() => !!document.querySelector('[data-testid="send-amount-input"]'))
	expect(hasAmountInput).toBe(true)

	// Verify no "No available tokens" message
	const bodyText = await page.evaluate(() => document.body.innerText)
	expect(bodyText).not.toContain("No available tokens")

	console.log("✓ Send from token detail page loads token correctly")

	// Close popup via Escape
	await page.keyboard.press("Escape")
	await page.close()
})
