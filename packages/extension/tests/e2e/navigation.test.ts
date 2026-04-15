import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"
import { clickNavTab, ensureUnlocked } from "./fixtures/helpers"

test("settings page shows all sections", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await clickNavTab(page, "settings")
	await waitForHash(page, "#/popup/settings")

	await page.waitForSelector("text/General", { visible: true, timeout: 5_000 })
	await page.waitForSelector("text/Security", { visible: true, timeout: 5_000 })
	await page.waitForSelector("text/About", { visible: true, timeout: 5_000 })

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("activity page shows empty state", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await clickNavTab(page, "activity")
	await waitForHash(page, "#/popup/activity")

	// The activity page should show the transactions header
	await page.waitForSelector("text/Transactions", { visible: true, timeout: 5_000 })

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("bottom navigation switches between pages", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	// Navigate to activity
	await clickNavTab(page, "activity")
	await waitForHash(page, "#/popup/activity")

	// Navigate to settings
	await clickNavTab(page, "settings")
	await waitForHash(page, "#/popup/settings")

	// Navigate back to general
	await clickNavTab(page, "general")
	await waitForHash(page, "#/popup/general")

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("about page shows version info", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await clickNavTab(page, "settings")
	await waitForHash(page, "#/popup/settings")

	// Click "About Nulo" or "About" link
	const aboutLink = await page.waitForSelector("text/About", { visible: true, timeout: 5_000 })
	await aboutLink!.click()

	await waitForHash(page, "#/popup/settings/about")

	await page.waitForSelector("text/Wallet version", { visible: true, timeout: 5_000 })
	await page.waitForSelector("text/Aztec version", { visible: true, timeout: 5_000 })

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})
