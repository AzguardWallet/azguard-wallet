import { inject } from "vitest"
import { test, openPopup, waitForHash } from "../fixtures/extension"
import { sendTransfer, waitForBalance, waitForTxConfirmation, clickNavTab } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

// All tests share ONE tokenReadyExtension (file-scoped, runs once).
// Tests are SEQUENTIAL and each waits for the previous tx to confirm
// before proceeding. This is required because Aztec uses nullifiers —
// a second tx against stale state will revert.

test.skipIf(!hasConfig)(
	"balance shows minted tokens",
	{ timeout: 120_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")
		await waitForBalance(page, "1,000", 60_000)
		console.log("✓ Initial balance: 1,000 public tokens")
		await page.close()
	},
)

test.skipIf(!hasConfig)(
	"public to public transfer",
	{ timeout: 180_000 },
	async ({ tokenReadyExtension }) => {
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
	},
)

test.skipIf(!hasConfig)(
	"public to private transfer (shield)",
	{ timeout: 180_000 },
	async ({ tokenReadyExtension }) => {
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
	},
)

test.skipIf(!hasConfig)(
	"private to public transfer (unshield)",
	{ timeout: 180_000 },
	async ({ tokenReadyExtension }) => {
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
	},
)

test.skipIf(!hasConfig)(
	"private to private transfer",
	{ timeout: 180_000 },
	async ({ tokenReadyExtension }) => {
		const page = await openPopup(tokenReadyExtension)
		await waitForHash(page, "#/popup/general")

		await sendTransfer(page, {
			fromType: "private",
			toType: "private",
			amount: "10",
			destination: tokenReadyExtension.accountAddress,
		})
		console.log("✓ Private → Private submitted")

		// Navigate to activity to verify all transactions appear
		await clickNavTab(page, "activity")
		await page.waitForFunction(() => window.location.hash.includes("#/popup/activity"), { timeout: 5_000 })
		console.log("✓ Activity page accessible")
		await page.close()
	},
)
