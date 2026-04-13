import { inject } from "vitest"
import { test, openPopup, waitForHash } from "../fixtures/extension"
import { clickNavTab } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

test.skipIf(!hasConfig)(
	"balance shows minted tokens",
	{ timeout: 120_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")

		await page.waitForFunction(
			() => document.body.innerText.includes("1,000") || document.body.innerText.includes("Pub 1,000"),
			{ timeout: 60_000, polling: 3_000 },
		)
	},
)

test.skipIf(!hasConfig)(
	"public to public transfer",
	{ timeout: 180_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")

		// Wait for token to be visible
		await page.waitForFunction(() => document.body.innerText.includes("TestToken"), { timeout: 30_000 })

		// Open SendPopup via testid
		await page.evaluate(() => {
			(document.querySelector('[data-testid="actions-send"]') as HTMLElement)?.click()
		})

		// Wait for SendTypesCard to render (has from/to type badges)
		await page.waitForSelector('[data-testid="send-from-type"]', { timeout: 10_000 })

		// Toggle FROM from private to public (we minted public tokens)
		await page.evaluate(() => {
			const badge = document.querySelector('[data-testid="send-from-type"]') as HTMLElement
			if (badge?.textContent?.toLowerCase().includes("private")) badge.click()
		})
		await new Promise((r) => setTimeout(r, 500))

		// Toggle TO from private to public
		await page.evaluate(() => {
			const badge = document.querySelector('[data-testid="send-to-type"]') as HTMLElement
			if (badge?.textContent?.toLowerCase().includes("private")) badge.click()
		})
		await new Promise((r) => setTimeout(r, 500))

		// Log the final transfer type
		const types = await page.evaluate(() => ({
			from: document.querySelector('[data-testid="send-from-type"]')?.textContent?.trim(),
			to: document.querySelector('[data-testid="send-to-type"]')?.textContent?.trim(),
		}))
		console.log("Transfer:", types.from, "→", types.to)

		// Enter amount
		const amountInput = await page.waitForSelector('[data-testid="send-amount-input"]', { visible: true })
		await amountInput!.click({ clickCount: 3 })
		await amountInput!.type("10")

		// Enter destination (self-transfer)
		const selfAddress = tokenReadyExtension.accountAddress
		await page.type('[data-testid="send-destination-field"] input', selfAddress)

		// Wait for send button to become clickable
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('[data-testid="send-submit"]') as HTMLElement
				return btn && getComputedStyle(btn).pointerEvents !== "none"
			},
			{ timeout: 120_000, polling: 3_000 },
		)

		// Send
		await page.evaluate(() => {
			(document.querySelector('[data-testid="send-submit"]') as HTMLElement)?.click()
		})

		// Wait for submission toast
		await page.waitForFunction(
			() => document.body.innerText.includes("Transaction submitted") || document.body.innerText.includes("submitted"),
			{ timeout: 60_000, polling: 2_000 },
		)
		console.log("Transaction submitted!")

		// Navigate to activity
		await clickNavTab(page, "activity")
		await page.waitForFunction(() => window.location.hash.includes("#/popup/activity"), { timeout: 5_000 })
	},
)
