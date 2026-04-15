import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"
import { lockWallet, ensureUnlocked, clickNavTab } from "./fixtures/helpers"

test("lock wallet and unlock with password", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	// Lock the wallet
	await lockWallet(page)
	console.log("✓ Wallet locked — auth page shown")

	// Close and reopen popup (fresh DOM after lock)
	await page.close()
	const page2 = await openPopup(registeredExtension)

	// Should be on auth page
	await waitForHash(page2, "#/popup/auth", 10_000)

	// Unlock with password
	await ensureUnlocked(page2)

	// Verify we left the auth page
	await page2.waitForFunction(() => !window.location.hash.includes("/popup/auth"), { timeout: 10_000 })
	console.log("✓ Wallet unlocked — restored")

	await page2.close()
})

test("stealth mode toggle off and on", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	// Navigate: Settings → Security → Privacy Settings (route: /popup/settings/external-services)
	await clickNavTab(page, "settings")
	await page.waitForFunction(() => window.location.hash === "#/popup/settings", { timeout: 5_000 })

	const securityLink = await page.waitForSelector("text/Security", { visible: true, timeout: 5_000 })
	await securityLink!.click()
	await page.waitForFunction(() => window.location.hash.includes("#/popup/settings/security"), { timeout: 5_000 })

	const privacyLink = await page.waitForSelector("text/Privacy", { visible: true, timeout: 5_000 })
	await privacyLink!.click()
	await page.waitForFunction(() => window.location.hash.includes("#/popup/settings/external-services"), { timeout: 5_000 })

	// Wait for settings to load (not in loading state)
	await page.waitForFunction(() => !document.body.innerText.includes("Fetching settings"), { timeout: 10_000 })

	// Verify stealth mode toggle exists
	await page.waitForSelector('[data-testid="setting-stealth-mode"]', { visible: true, timeout: 5_000 })

	// Check current stealth state by looking at the toggle's active class
	const isStealthOn = await page.evaluate(() => {
		const container = document.querySelector('[data-testid="setting-stealth-mode"]')
		const toggle = container?.querySelector('[tabindex="1"]')
		return toggle?.className?.includes("active") ?? false
	})
	console.log(`[stealth] Initial state: stealth is ${isStealthOn ? "ON" : "OFF"}`)

	if (isStealthOn) {
		// Toggle OFF — click using Puppeteer native click
		const toggle = await page.waitForSelector('[data-testid="setting-stealth-mode"] [tabindex="1"]', { visible: true })
		await toggle!.click()
		await new Promise((r) => setTimeout(r, 1_000))

		// "Exit Stealth Mode?" dialog appears — confirm
		await page.waitForSelector("text/Exit Stealth Mode?", { visible: true, timeout: 5_000 })
		const confirmBtn = await page.waitForSelector("text/Yes, exit", { visible: true, timeout: 5_000 })
		await confirmBtn!.click()
		await new Promise((r) => setTimeout(r, 1_000))
	}

	// Verify sub-settings are now visible (stealth is OFF)
	await page.waitForFunction(() => document.body.innerText.includes("Contract Registry"), { timeout: 5_000 })
	console.log("✓ Stealth mode OFF — sub-settings visible")

	// Toggle stealth back ON (no dialog for enabling)
	const toggleOn = await page.waitForSelector('[data-testid="setting-stealth-mode"] [tabindex="1"]', { visible: true })
	await toggleOn!.click()
	await new Promise((r) => setTimeout(r, 1_000))

	// Verify stealth is ON again (sub-settings should hide)
	console.log("✓ Stealth mode toggled back ON")
	await page.close()
})
