import { expect, inject } from "vitest"
import { test, openPopup, waitForHash, clickButtonByText } from "../fixtures/extension"
import { refreshBalances, getAccountAddress, createAccount, clickNavTab } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

// All tests in this file share ONE tokenReadyExtension (file-scoped).
// The fixture runs ONCE: launches browser, registers profile, switches to local network,
// mints 1000 public tokens via EmbeddedWallet, imports the token.

test.skipIf(!hasConfig)(
	"balance shows minted amount after refresh",
	{ timeout: 120_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")

		// Token should be imported from fixture
		await page.waitForSelector("text/TestToken", { visible: true, timeout: 30_000 })

		// Wait for balance to update — minted 1000 tokens (with 18 decimals)
		// Note: balance may already be visible if the extension synced during import.
		// If not, wait up to 60s with polling.
		await page.waitForFunction(
			() => {
				const text = document.body.innerText
				return text.includes("1,000") || text.includes("1000")
			},
			{ timeout: 60_000, polling: 3_000 },
		)
	},
)

test.skipIf(!hasConfig)(
	"create second account for transfers",
	{ timeout: 60_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")

		// Create a second account "Bob" for transfers
		await createAccount(page, "Bob")

		// Get Bob's address
		const bobAddress = await getAccountAddress(page)
		expect(bobAddress).toBeTruthy()
		expect(bobAddress).toMatch(/^0x/)
	},
)

test.skipIf(!hasConfig)(
	"public to public transfer",
	{ timeout: 180_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")

		// Get Bob's address (created in prior test — file-scoped fixture)
		const bobAddress = await getAccountAddress(page)

		// Click "Send" action (it's a Flex div, not a <button>)
		await page.evaluate(() => {
			const spans = [...document.querySelectorAll("span")]
			const sendSpan = spans.find((s) => s.textContent?.trim() === "Send")
			sendSpan?.parentElement?.click()
		})

		// Wait for SendPopup
		await page.waitForSelector('[data-testid="send-destination-input"]', { visible: true, timeout: 10_000 })

		// Enter amount
		const amountInput = await page.waitForSelector('[data-testid="send-amount-input"]', {
			visible: true,
			timeout: 5_000,
		})
		await amountInput!.click({ clickCount: 3 })
		await amountInput!.type("10")

		// Enter destination (Bob's address)
		await page.type('[data-testid="send-destination-input"] input', bobAddress)

		// Wait for fee estimation + Send button to become enabled
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('[data-testid="send-button"]') as HTMLButtonElement
				if (!btn) return false
				return !btn.disabled && getComputedStyle(btn).pointerEvents !== "none"
			},
			{ timeout: 60_000, polling: 2_000 },
		)

		// Click the Send submit button
		await page.evaluate(() => {
			const btn = document.querySelector('[data-testid="send-button"]') as HTMLButtonElement
			btn?.click()
		})

		// Wait for transaction submission
		await page.waitForFunction(
			() =>
				document.body.innerText.includes("Transaction submitted") ||
				document.body.innerText.includes("submitted"),
			{ timeout: 60_000, polling: 2_000 },
		)

		// Verify: navigate to activity tab and check for transaction
		await clickNavTab(page, "activity")
		await page.waitForFunction(() => window.location.hash.includes("#/popup/activity"), { timeout: 5_000 })

		// Wait for a transaction entry to appear (may take time to settle)
		await page.waitForFunction(
			() => {
				const text = document.body.innerText
				return text.includes("Transfer") || text.includes("transfer") || text.includes("Send")
			},
			{ timeout: 30_000, polling: 3_000 },
		)
	},
)
