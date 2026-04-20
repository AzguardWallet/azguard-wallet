import { expect } from "vitest"
import { test, openPopup, waitForHash, typeIntoInput, clickButtonByText } from "./fixtures/extension"

test("fresh install shows register page", async ({ extension }) => {
	const page = await openPopup(extension)

	await waitForHash(page, "#/popup/register")

	await page.waitForSelector("text/Create Profile", { visible: true })
	await page.waitForSelector("text/Import Profile", { visible: true })
})

test("create profile with password", async ({ extension }) => {
	const page = await openPopup(extension)
	await waitForHash(page, "#/popup/register")

	// Wait for GlobalLoader to disappear
	await page.waitForFunction(() => !document.querySelector('[data-testid="global-loader"]'), {
		timeout: 15_000,
		polling: 500,
	})

	// Click the actual <button> element (not a descendant text node)
	await clickButtonByText(page, "Create Profile")

	// Wait for RegisterPopup to fully mount
	await page.waitForFunction(
		() => {
			const buttons = [...document.querySelectorAll("button")]
			return buttons.some((b) => b.textContent?.includes("Create with Password"))
		},
		{ timeout: 10_000 },
	)

	await page.waitForSelector('input[placeholder="Strong password"]', {
		visible: true,
		timeout: 10_000,
	})

	// Fill passwords (≥8 chars, matching)
	const testPassword = "TestPassword123!"
	await typeIntoInput(page, "Strong password", testPassword)
	await typeIntoInput(page, "Repeat password", testPassword)

	// Wait for submit button to become enabled
	await page.waitForFunction(
		() => {
			const buttons = [...document.querySelectorAll("button")]
			const btn = buttons.find((b) => b.textContent?.includes("Create with Password"))
			return btn && !btn.disabled
		},
		{ timeout: 5_000 },
	)

	// Submit
	await clickButtonByText(page, "Create with Password")

	// Wait for async navigation to general page
	await waitForHash(page, "#/popup/general", 15_000)

	// Verify post-registration state
	await page.waitForSelector('[data-testid="account-selector"]', { visible: true, timeout: 10_000 })
	await page.waitForSelector("text/Send", { visible: true })
	await page.waitForSelector("text/Receive", { visible: true })

	// Bottom navigation tabs present
	const navLinks = await page.evaluate(() => {
		const links = [...document.querySelectorAll("a")]
		return links.map((a) => a.getAttribute("href")).filter((h) => h?.includes("#/popup/"))
	})
	expect(navLinks).toContain("#/popup/activity")
	expect(navLinks).toContain("#/popup/general")
	expect(navLinks).toContain("#/popup/settings")

	expect(extension.consoleErrors).toEqual([])
	expect(extension.pageErrors).toEqual([])
})
