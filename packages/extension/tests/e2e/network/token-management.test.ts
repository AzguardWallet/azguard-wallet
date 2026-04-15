import { inject, expect } from "vitest"
import { test, openPopup, waitForHash } from "../fixtures/extension"
import { navigateToSettings, waitForToast } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

test.skipIf(!hasConfig)("delete imported token from settings", { timeout: 120_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	// Navigate: Settings → General → Tokens
	await navigateToSettings(page, "General", "Tokens")

	// Verify token row with "TST" exists
	await page.waitForSelector('[data-testid="token-row"]', { visible: true, timeout: 10_000 })
	const hasToken = await page.evaluate(() => document.body.innerText.includes("TST"))
	expect(hasToken).toBe(true)
	console.log("✓ TST token found in token management list")

	// Click delete icon
	const deleteBtn = await page.waitForSelector('[data-testid="token-delete"]', { visible: true, timeout: 5_000 })
	await deleteBtn!.click()

	// Confirm deletion in ConfirmPopup
	await page.waitForSelector("text/Remove this token?", { visible: true, timeout: 5_000 })
	const confirmBtn = await page.waitForSelector("text/Yes, delete token", { visible: true, timeout: 5_000 })
	await confirmBtn!.click()

	// Wait for success toast
	await waitForToast(page, "Token successfully deleted", 5_000)
	console.log("✓ Token deleted, toast shown")

	// Verify token row is gone
	await page.waitForFunction(() => !document.body.innerText.includes("TST"), { timeout: 5_000 })
	console.log("✓ TST no longer in token list")

	await page.close()
})
