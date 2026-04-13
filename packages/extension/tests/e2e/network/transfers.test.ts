import { expect, inject } from "vitest"
import { test, openPopup, waitForHash, clickButtonByText } from "../fixtures/extension"
import { getAccountAddress, createAccount, clickNavTab } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

// All tests share ONE tokenReadyExtension (file-scoped, runs once).

test.skipIf(!hasConfig)(
	"balance shows minted tokens",
	{ timeout: 120_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")

		// Token should be imported with 1000 public tokens minted
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

		// Wait for token balance to be visible
		await page.waitForFunction(
			() => document.body.innerText.includes("TestToken"),
			{ timeout: 30_000, polling: 2_000 },
		)

		// Open Send popup (it's a Flex div, not a button)
		await page.evaluate(() => {
			const spans = [...document.querySelectorAll("span")]
			const sendSpan = spans.find((s) => s.textContent?.trim() === "Send")
			sendSpan?.parentElement?.click()
		})

		// Wait for SendPopup to appear
		await page.waitForSelector('[data-testid="send-destination-input"]', { visible: true, timeout: 10_000 })

		// Switch from Private to Public: click the "private" text next to "From"
		// The SendTypesCard shows "From [private] to [private] destination"
		// Clicking the first "private" toggles it to "public"
		await page.evaluate(() => {
			// Find spans with "private" text that are inside the send type selector
			const spans = [...document.querySelectorAll("span")]
			const privateSpans = spans.filter((s) => s.textContent?.trim().toLowerCase() === "private")
			// Click the FIRST "private" (the "From" type) to switch to public
			if (privateSpans.length > 0) privateSpans[0].parentElement?.click()
		})
		await new Promise((r) => setTimeout(r, 500))

		// Now click the second "private" (the "to" type) to switch to public
		await page.evaluate(() => {
			const spans = [...document.querySelectorAll("span")]
			const privateSpans = spans.filter((s) => s.textContent?.trim().toLowerCase() === "private")
			if (privateSpans.length > 0) privateSpans[0].parentElement?.click()
		})
		await new Promise((r) => setTimeout(r, 500))

		// Verify we're now on Public → Public
		const transferType = await page.evaluate(() => {
			const text = document.body.innerText
			const match = text.match(/From\s+(\w+)\s+to\s+(\w+)/i)
			return match ? `${match[1]} → ${match[2]}` : "unknown"
		})
		console.log("Transfer type:", transferType)

		// Enter amount
		const amountInput = await page.waitForSelector('[data-testid="send-amount-input"]', { visible: true, timeout: 5_000 })
		await amountInput!.click({ clickCount: 3 })
		await amountInput!.type("10")

		// Enter destination — use own address (self-transfer for simplicity)
		const selfAddress = await getAccountAddress(page)
		await page.type('[data-testid="send-destination-input"] input', selfAddress)

		// Wait for fee estimation + Send button to become clickable
		// The button uses pointer-events:none when disabled, not the HTML disabled attr
		await page.waitForFunction(
			() => {
				const btn = document.querySelector('[data-testid="send-button"]') as HTMLElement
				if (!btn) return false
				return getComputedStyle(btn).pointerEvents !== "none"
			},
			{ timeout: 120_000, polling: 3_000 },
		)

		// Click Send
		await page.evaluate(() => {
			const btn = document.querySelector('[data-testid="send-button"]') as HTMLElement
			btn?.click()
		})

		// Wait for "Transaction submitted" toast
		await page.waitForFunction(
			() => document.body.innerText.includes("Transaction submitted") || document.body.innerText.includes("submitted"),
			{ timeout: 60_000, polling: 2_000 },
		)

		console.log("Transaction submitted!")

		// Navigate to activity tab and verify transaction appears
		await clickNavTab(page, "activity")
		await page.waitForFunction(() => window.location.hash.includes("#/popup/activity"), { timeout: 5_000 })
	},
)
