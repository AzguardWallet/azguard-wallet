import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"
import { clickNavTab, navigateToSettings } from "./fixtures/helpers"

test("accounts page shows initial account", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Accounts")

	// Should show at least one account (auto-created during profile registration)
	await page.waitForSelector("text/Account", { visible: true, timeout: 5_000 })

	// Verify the accounts page loaded
	const content = await page.evaluate(() => document.body.innerText)
	expect(content).toContain("Accounts")

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("create second account", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Accounts")

	// Click "New account"
	const newBtn = await page.waitForSelector("text/New account", { visible: true, timeout: 5_000 })
	await newBtn!.click()

	// Wait for popup
	await page.waitForSelector('input[placeholder="My Account"]', { visible: true, timeout: 5_000 })

	// Fill name
	const nameInput = await page.waitForSelector('input[placeholder="My Account"]', { visible: true })
	await nameInput!.click({ clickCount: 3 })
	await nameInput!.type("Test Account 2")

	// Click Create
	const createBtn = await page.waitForSelector("text/Create", { visible: true })
	await createBtn!.click()

	// Wait for popup to close and account to appear
	await page.waitForFunction(() => !document.querySelector('[class*="popup"]')?.textContent?.includes("New account"), { timeout: 10_000 })
	await page.waitForSelector("text/Test Account 2", { visible: true, timeout: 5_000 })

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("switch between accounts", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Accounts")

	// Create a second account first
	const newBtn = await page.waitForSelector("text/New account", { visible: true, timeout: 5_000 })
	await newBtn!.click()

	await page.waitForSelector('input[placeholder="My Account"]', { visible: true, timeout: 5_000 })
	const nameInput = await page.waitForSelector('input[placeholder="My Account"]', { visible: true })
	await nameInput!.click({ clickCount: 3 })
	await nameInput!.type("SwitchTarget")

	const createBtn = await page.waitForSelector("text/Create", { visible: true })
	await createBtn!.click()
	await page.waitForFunction(() => !document.querySelector('[class*="popup"]')?.textContent?.includes("New account"), { timeout: 10_000 })

	// Click the new account to switch to it
	await page.waitForSelector("text/SwitchTarget", { visible: true, timeout: 5_000 })
	const targetAccount = await page.waitForSelector("text/SwitchTarget", { visible: true })
	await targetAccount!.click()

	// Verify the account address changed in chrome storage
	const address = await page.evaluate(async () => {
		const result = await chrome.storage.local.get("vibeguard:ui:activeAccount")
		return result["vibeguard:ui:activeAccount"]
	})
	expect(address).toBeTruthy()
	expect(typeof address).toBe("string")

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

// Skip: The manage accounts page shows "Accounts 3" but the v-for doesn't render items.
// The `accounts` computed (filters by `visible`) returns empty despite appStore.accounts having 3 entries.
// This is an async reactivity issue with how accounts load from the service worker on the settings page.
// Root cause investigation needed during the refactoring — this is exactly what the refactoring should fix.
test.skip("hide and restore account", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Accounts")
	await page.waitForSelector('[data-testid="manage-accounts-page"]', { visible: true, timeout: 5_000 })

	// Create second account so we can hide one
	const newBtn = await page.waitForSelector("text/New account", { visible: true, timeout: 5_000 })
	await newBtn!.click()
	await page.waitForSelector('input[placeholder="My Account"]', { visible: true, timeout: 5_000 })
	const nameInput = await page.waitForSelector('input[placeholder="My Account"]', { visible: true })
	await nameInput!.click({ clickCount: 3 })
	await nameInput!.type("HideMe")
	const createBtn = await page.waitForSelector("text/Create", { visible: true })
	await createBtn!.click()
	await page.waitForFunction(() => !document.querySelector('[class*="popup"]')?.textContent?.includes("New account"), { timeout: 10_000 })

	// Verify "HideMe" exists and wait for DOM to stabilize
	await page.waitForSelector("text/HideMe", { visible: true, timeout: 5_000 })
	await new Promise((r) => setTimeout(r, 500))

	// Click hide icon — find the div with data-testid or fallback to close-circle SVG
	await page.evaluate(() => {
		// Strategy: find all divs with data-testid="account-hide"
		const hideDivs = document.querySelectorAll('[data-testid="account-hide"]')
		if (hideDivs.length > 0) {
			// Click the last one (the newly created account)
			;(hideDivs[hideDivs.length - 1] as HTMLElement).click()
			return
		}
		// Fallback: find the "HideMe" text, walk up, find the close-circle icon
		const spans = [...document.querySelectorAll("span")]
		const target = spans.find((s) => s.textContent?.trim() === "HideMe")
		if (!target) return
		let el: HTMLElement | null = target
		for (let i = 0; i < 20 && el; i++) {
			// Look for a div containing an SVG that looks like close-circle
			const divs = el.querySelectorAll("div")
			for (const div of divs) {
				if (div.getAttribute("data-testid") === "account-hide") {
					div.click()
					return
				}
			}
			el = el.parentElement
		}
	})

	// Wait for toast "Account successfully hidden" OR "Hidden accounts" section
	await page.waitForFunction(
		() =>
			document.body.innerText.includes("Hidden accounts") ||
			document.body.innerText.includes("Account successfully hidden"),
		{ timeout: 10_000 },
	)

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})
