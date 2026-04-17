import { expect } from "vitest"
import { test, openPopup, waitForHash } from "./fixtures/extension"
import { addContact, navigateToSettings } from "./fixtures/helpers"

// Valid-looking 66-char hex addresses — each test needs a unique address (duplicates are rejected)
const ADDR_ALICE = "0x15c4ac6afcffdf59aa8a1fb3317ff0c86aee3eb02f9e52c3612e1163d4701446"
const ADDR_BOB = "0x25c4ac6afcffdf59aa8a1fb3317ff0c86aee3eb02f9e52c3612e1163d4701447"
const ADDR_DELETE = "0x35c4ac6afcffdf59aa8a1fb3317ff0c86aee3eb02f9e52c3612e1163d4701448"

test("contacts page shows empty state", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Contacts")

	const content = await page.evaluate(() => document.body.innerText)
	expect(content).toContain("Contacts")

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("add contact via popup", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Contacts")

	await addContact(page, "Alice", ADDR_ALICE)

	// Verify contact appears in list
	await page.waitForSelector("text/Alice", { visible: true, timeout: 5_000 })

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("edit contact name", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Contacts")

	// Add a contact first, then wait for DOM to stabilize
	await addContact(page, "Bob", ADDR_BOB)
	await page.waitForFunction(() => document.body.innerText.includes("Bob"), { timeout: 5_000 })
	await new Promise((r) => setTimeout(r, 500)) // Let Vue fully settle

	// Click edit icon via evaluate (icon is only visible on hover)
	await page.evaluate(() => {
		const el = document.querySelector('[data-testid="contact-edit"]') as HTMLElement
		el?.click()
	})

	// Wait for edit popup
	await page.waitForSelector("text/Edit contact", { visible: true, timeout: 5_000 })

	// Change name (placeholder is "New contact")
	const nameInput = await page.waitForSelector('input[placeholder="New contact"]', { visible: true, timeout: 5_000 })
	await nameInput!.click({ clickCount: 3 })
	await nameInput!.type("Bobby")

	// Click "Update contact" button
	const updateBtn = await page.waitForSelector("text/Update contact", { visible: true })
	await updateBtn!.click()

	// Verify updated name
	await page.waitForSelector("text/Bobby", { visible: true, timeout: 5_000 })

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})

test("delete contact", async ({ registeredExtension }) => {
	const page = await openPopup(registeredExtension)
	await waitForHash(page, "#/popup/general")

	await navigateToSettings(page, "General", "Contacts")

	// Add a contact first, then wait for DOM to stabilize
	await addContact(page, "ToDelete", ADDR_DELETE)
	await page.waitForFunction(() => document.body.innerText.includes("ToDelete"), { timeout: 5_000 })
	await new Promise((r) => setTimeout(r, 500)) // Let Vue fully settle

	// Click delete icon for "ToDelete" contact (there may be multiple contacts from prior tests)
	await page.evaluate(() => {
		// Find the delete icon closest to the "ToDelete" text
		const spans = [...document.querySelectorAll("span")]
		const target = spans.find((s) => s.textContent?.trim() === "ToDelete")
		if (!target) return
		// Walk up to the contact item container, then find its delete icon
		let container = target.parentElement
		for (let i = 0; i < 10 && container; i++) {
			const del = container.querySelector('[data-testid="contact-delete"]') as HTMLElement
			if (del) {
				del.click()
				return
			}
			container = container.parentElement
		}
	})

	// Confirm deletion in ConfirmPopup (button text is "Yes, delete contact")
	await page.waitForSelector("text/Yes, delete contact", { visible: true, timeout: 5_000 })
	const confirmBtn = await page.waitForSelector("text/Yes, delete contact", { visible: true })
	await confirmBtn!.click()

	// Verify removed
	await page.waitForFunction(() => !document.body.innerText.includes("ToDelete"), { timeout: 5_000 })

	expect(registeredExtension.consoleErrors).toEqual([])
	expect(registeredExtension.pageErrors).toEqual([])
})
