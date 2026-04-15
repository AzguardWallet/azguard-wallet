import { inject, expect } from "vitest"
import { test, openPopup, waitForHash } from "../fixtures/extension"
import { sendTransfer, selectFeeMethod, waitForToast } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

// Fee method tests use separate fixtures from transfer tests.
// Each test verifies a different fee payment method via the FeeSettingsCard UI.

test.skipIf(!hasConfig)("sponsored FPC is default fee method", { timeout: 180_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	// Open SendPopup
	await page.evaluate(() => {
		;(document.querySelector('[data-testid="actions-send"]') as HTMLElement)?.click()
	})
	await page.waitForSelector('[data-testid="send-from-type"]', { timeout: 10_000 })

	// Wait for FPC auto-discovery to complete
	await page.waitForFunction(
		() => {
			const trigger = document.querySelector('[data-testid="send-fee-method-trigger"]')
			return trigger?.textContent?.includes("Sponsored")
		},
		{ timeout: 30_000, polling: 1_000 },
	)

	const triggerText = await page.evaluate(() => document.querySelector('[data-testid="send-fee-method-trigger"]')?.textContent?.trim())
	console.log(`[fee-methods] Default fee method: "${triggerText}"`)
	expect(triggerText).toContain("Sponsored")

	console.log("✓ Sponsored FPC is the default fee method")
	await page.close()
})

test.skipIf(!hasConfig)("transfer with sponsored FPC fee", { timeout: 180_000 }, async ({ tokenReadyExtension }) => {
	const page = await openPopup(tokenReadyExtension)
	await waitForHash(page, "#/popup/general")

	await sendTransfer(page, {
		fromType: "public",
		toType: "public",
		amount: "1",
		destination: tokenReadyExtension.accountAddress,
	})
	console.log("✓ Transfer with Sponsored FPC submitted")
	await page.close()
})

test.skipIf(!hasConfig)("transfer with public Fee Juice", { timeout: 300_000 }, async ({ feeJuiceReadyExtension }) => {
	const page = await openPopup(feeJuiceReadyExtension)
	await waitForHash(page, "#/popup/general")

	// Open SendPopup
	await page.evaluate(() => {
		;(document.querySelector('[data-testid="actions-send"]') as HTMLElement)?.click()
	})
	await page.waitForSelector('[data-testid="send-from-type"]', { timeout: 10_000 })

	// Toggle to public→public
	await page.evaluate(() => {
		;(document.querySelector('[data-testid="send-from-type"]') as HTMLElement)?.click()
	})
	await new Promise((r) => setTimeout(r, 500))
	await page.evaluate(() => {
		;(document.querySelector('[data-testid="send-to-type"]') as HTMLElement)?.click()
	})
	await new Promise((r) => setTimeout(r, 500))

	// Wait for amount input to be enabled
	await page.waitForFunction(
		() => {
			const input = document.querySelector('[data-testid="send-amount-input"]') as HTMLInputElement
			return input && !input.disabled
		},
		{ timeout: 60_000, polling: 2_000 },
	)

	// Enter amount
	const amountInput = await page.waitForSelector('[data-testid="send-amount-input"]', { visible: true })
	await amountInput!.click({ clickCount: 3 })
	await amountInput!.type("1")

	// Enter destination
	const destInput = await page.waitForSelector('[data-testid="send-destination-field"] input', { visible: true })
	await destInput!.click({ clickCount: 3 })
	await destInput!.type(feeJuiceReadyExtension.accountAddress)

	// Now switch fee method to Fee Juice (AFTER entering details, so the re-estimation uses FJ)
	await selectFeeMethod(page, "public")
	console.log("[fee-methods] Switched to Fee Juice (public)")

	// Wait for send button to become clickable (re-estimation with Fee Juice)
	await page.waitForFunction(
		() => {
			const btn = document.querySelector('[data-testid="send-submit"]') as HTMLElement
			return btn && getComputedStyle(btn).pointerEvents !== "none"
		},
		{ timeout: 120_000, polling: 3_000 },
	)

	// Give PXE time to sync after fee estimation
	await new Promise((r) => setTimeout(r, 5_000))

	// Submit
	const submitBtn = await page.waitForSelector('[data-testid="send-submit"]', { visible: true })
	await submitBtn!.scrollIntoView()
	await submitBtn!.click()

	// Wait for toast
	await waitForToast(page, "Transaction submitted", 60_000)

	console.log("✓ Transfer with Fee Juice (public) submitted")
	await page.close()
})

test.skipIf(!hasConfig)("gas balance card shows non-zero FeeJuice", { timeout: 120_000 }, async ({ feeJuiceReadyExtension }) => {
	const page = await openPopup(feeJuiceReadyExtension)
	await waitForHash(page, "#/popup/general")

	// Wait for GasBalanceCard to load and show a non-zero public FJ balance
	// The gas balance refreshes async after the PXE syncs blocks
	await page.waitForSelector('[data-testid="gas-balance-public"]', { visible: true, timeout: 60_000 })

	const balanceText = await page.evaluate(() => document.querySelector('[data-testid="gas-balance-public"]')?.textContent?.trim() || "")
	console.log(`[gas-balance] Public FJ balance: "${balanceText}"`)

	// Should contain "FJ" and NOT be "0 FJ"
	expect(balanceText).toContain("FJ")
	expect(balanceText).not.toBe("0 FJ")

	console.log("✓ Gas balance card shows non-zero FeeJuice")
	await page.close()
})
