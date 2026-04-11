import { expect } from "vitest"
import { test, openPopup, waitForHash, typeIntoInput } from "./fixtures/extension"

test("fresh install shows register page", async ({ extension }) => {
	const page = await openPopup(extension)

	await waitForHash(page, "#/popup/register")

	await page.waitForSelector("text/Create Profile", { visible: true })
	await page.waitForSelector("text/Import Profile", { visible: true })
})

test("create profile with password", async ({ extension }) => {
	const page = await openPopup(extension)
	await waitForHash(page, "#/popup/register")

	// Click "Create Profile" to open the password overlay
	const createBtn = await page.waitForSelector("text/Create Profile", { visible: true })
	await createBtn!.click()

	// Wait for password overlay to slide in
	await page.waitForSelector('input[placeholder="Strong password"]', {
		visible: true,
		timeout: 3_000,
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
	const submitBtn = await page.waitForSelector("text/Create with Password", { visible: true })
	await submitBtn!.click()

	// Wait for async navigation to general page
	await waitForHash(page, "#/popup/general", 15_000)

	// Verify post-registration state
	await page.waitForSelector("text/Account", { visible: true, timeout: 3_000 })
	await page.waitForSelector("text/Testnet", { visible: true })
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
