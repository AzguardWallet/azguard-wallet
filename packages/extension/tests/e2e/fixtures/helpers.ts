import type { Page } from "puppeteer"

const TEST_PASSWORD = "TestPassword123!"

// ── Auth ───────────────────────────────────────────────────────────────

/** If the wallet is locked (auth page), re-enter the password. */
export async function ensureUnlocked(page: Page): Promise<void> {
	const hash = await page.evaluate(() => window.location.hash)
	if (!hash.includes("/popup/auth")) return

	const input = await page.waitForSelector('input[placeholder="Enter password"]', {
		visible: true,
		timeout: 5_000,
	})
	await input!.click({ clickCount: 3 })
	await input!.type(TEST_PASSWORD)

	const continueBtn = await page.waitForSelector("text/Continue", { visible: true })
	await continueBtn!.click()

	// Wait for navigation away from auth
	await page.waitForFunction(() => !window.location.hash.includes("/popup/auth"), { timeout: 10_000 })
}

// ── Navigation ─────────────────────────────────────────────────────────

/** Click a bottom navigation tab. */
export async function clickNavTab(page: Page, tab: "activity" | "general" | "settings"): Promise<void> {
	const link = await page.waitForSelector(`[data-testid="nav-${tab}"]`, {
		visible: true,
		timeout: 5_000,
	})
	await link!.click()
}

/** Navigate to a settings sub-page by clicking through the UI. */
export async function navigateToSettings(page: Page, ...path: string[]): Promise<void> {
	await clickNavTab(page, "settings")
	await page.waitForFunction(() => window.location.hash.includes("#/popup/settings"), { timeout: 5_000 })

	for (const item of path) {
		const link = await page.waitForSelector(`text/${item}`, { visible: true, timeout: 5_000 })
		await link!.click()
		// Small delay for route transition
		await page.waitForFunction(
			(text: string) => {
				// Wait until the breadcrumb or page header reflects the navigation
				return document.body.innerText.includes(text)
			},
			{ timeout: 5_000 },
			item,
		)
	}
}

// ── Network ────────────────────────────────────────────────────────────

/** Open the NetworksPopup by clicking the globe icon in the header. */
export async function openNetworkPopup(page: Page): Promise<void> {
	const networkBtn = await page.waitForSelector('[data-testid="network-button"]', {
		visible: true,
		timeout: 5_000,
	})
	await networkBtn!.click()
	await page.waitForSelector("text/Switch network", { visible: true, timeout: 5_000 })
}

/** Switch to a network by name (opens NetworksPopup, clicks the network). */
export async function switchToNetwork(page: Page, networkName: string): Promise<void> {
	await openNetworkPopup(page)
	const item = await page.waitForSelector(`text/${networkName}`, { visible: true, timeout: 5_000 })
	await item!.click()
	// Wait for popup to close (no more "Switch network" text)
	await page.waitForFunction(() => !document.body.innerText.includes("Switch network"), { timeout: 5_000 })
}

/** Switch to the Local Network (chain ID 0, http://localhost:8080). */
export async function switchToLocalNetwork(page: Page): Promise<void> {
	await switchToNetwork(page, "Local Network")
}

// ── Account ────────────────────────────────────────────────────────────

/** Read the active account address from chrome.storage. */
export async function getAccountAddress(page: Page): Promise<string> {
	return await page.evaluate(async () => {
		const result = await chrome.storage.local.get("vibeguard:ui:activeAccount")
		return result["vibeguard:ui:activeAccount"] as string
	})
}

/** Create a new account via the NewAccountPopup. */
export async function createAccount(page: Page, name: string, persistent = false): Promise<void> {
	// Navigate to accounts page
	await navigateToSettings(page, "General", "Accounts")

	// Click "New account" button
	const newBtn = await page.waitForSelector("text/New account", { visible: true, timeout: 5_000 })
	await newBtn!.click()

	// Wait for popup (header says "New account")
	await page.waitForSelector('input[placeholder="My Account"]', { visible: true, timeout: 5_000 })

	// Fill name
	const nameInput = await page.waitForSelector('input[placeholder="My Account"]', {
		visible: true,
		timeout: 5_000,
	})
	await nameInput!.click({ clickCount: 3 })
	await nameInput!.type(name)

	// Toggle persistent if needed
	if (persistent) {
		const toggle = await page.waitForSelector("text/Enable persistent history", { visible: true })
		await toggle!.click()
	}

	// Click Create
	const createBtn = await page.waitForSelector("text/Create", { visible: true })
	await createBtn!.click()

	// Wait for popup to close (the "New account" header disappears)
	await page.waitForFunction(
		() => {
			// The popup has a header with "New account" text — wait for it to close
			const headers = [...document.querySelectorAll("*")]
			return !headers.some((el) => el.textContent?.trim() === "New account" && el.closest("[class*='popup']"))
		},
		{ timeout: 10_000 },
	)
}

/** Switch to an account by name via the AccountsPopup in header. */
export async function switchAccount(page: Page, name: string): Promise<void> {
	// Click the account name/vault in the header to open AccountsPopup
	const accountArea = await page.waitForSelector("text/Account", { visible: true, timeout: 5_000 })
	await accountArea!.click()

	// Wait for accounts popup
	await page.waitForSelector("text/Accounts", { visible: true, timeout: 5_000 })

	// Click the target account
	const target = await page.waitForSelector(`text/${name}`, { visible: true, timeout: 5_000 })
	await target!.click()
}

// ── Contact ────────────────────────────────────────────────────────────

/** Add a contact via the NewContactPopup. Uses evaluate for all clicks to avoid stale node refs. */
export async function addContact(page: Page, name: string, address: string): Promise<void> {
	// Wait for page to stabilize then click "New contact" via evaluate
	await page.waitForFunction(() => document.body.innerText.includes("Contacts"), { timeout: 5_000 })
	await new Promise((r) => setTimeout(r, 500))

	await page.evaluate(() => {
		const btns = [...document.querySelectorAll("button")]
		const btn = btns.find((b) => b.textContent?.includes("New contact"))
		btn?.click()
	})

	// Wait for popup to fully mount
	await page.waitForSelector("text/Add contact", { visible: true, timeout: 5_000 })
	await new Promise((r) => setTimeout(r, 300))

	// Fill name
	await page.type('input[placeholder="New contact"]', name)

	// Fill address
	await page.type('input[placeholder*="0x15c4"]', address)

	// Wait for button to be enabled then click via evaluate
	await page.waitForFunction(
		() => {
			const buttons = [...document.querySelectorAll("button")]
			const btn = buttons.find((b) => b.textContent?.includes("Add contact"))
			return btn && getComputedStyle(btn).pointerEvents !== "none"
		},
		{ timeout: 5_000 },
	)
	await page.evaluate(() => {
		const buttons = [...document.querySelectorAll("button")]
		const btn = buttons.find((b) => b.textContent?.includes("Add contact"))
		btn?.click()
	})

	// Wait for toast
	await waitForToast(page, "Contact is added")
}

/** Delete a contact by name (assumes contacts page is open). */
export async function deleteContact(page: Page, name: string): Promise<void> {
	// Hover over the contact to reveal action icons
	const contactEl = await page.waitForSelector(`text/${name}`, { visible: true, timeout: 5_000 })
	await contactEl!.hover()

	// Click delete icon (trash/bin icon appears on hover)
	// The delete icon is near the contact row — use evaluate to find it
	await page.evaluate((contactName: string) => {
		const items = [...document.querySelectorAll("[class*='item']")]
		const item = items.find((el) => el.textContent?.includes(contactName))
		const deleteBtn = item?.querySelector("[class*='action']") || item?.querySelector("svg:last-of-type")
		if (deleteBtn) (deleteBtn as HTMLElement).click()
	}, name)

	// Confirm deletion in ConfirmPopup
	await page.waitForSelector("text/Delete", { visible: true, timeout: 5_000 })
	const confirmBtn = await page.waitForSelector("text/Delete", { visible: true })
	await confirmBtn!.click()

	// Wait for contact to disappear
	await page.waitForFunction((n: string) => !document.body.innerText.includes(n), { timeout: 5_000 }, name)
}

// ── Token ──────────────────────────────────────────────────────────────

/** Import a token by contract address via the NewTokenPopup. */
export async function importToken(page: Page, contractAddress: string): Promise<void> {
	// Click the dots menu in TokensView then "Import token"
	// First find the three-dots button near "Tokens" text
	await page.evaluate(() => {
		const dotsButtons = [...document.querySelectorAll("[class*='dots'], [class*='menu']")]
		const tokensSection = [...document.querySelectorAll("*")].find((el) => el.textContent?.trim().startsWith("Tokens"))
		if (tokensSection) {
			const btn = tokensSection.querySelector("svg, [class*='trigger']")
			if (btn) (btn as HTMLElement).click()
		}
	})

	// Click "Import token" from dropdown
	const importOpt = await page.waitForSelector("text/Import token", { visible: true, timeout: 5_000 })
	await importOpt!.click()

	// Wait for NewTokenPopup
	await page.waitForSelector("text/New token", { visible: true, timeout: 5_000 })

	// Enter contract address
	const addrInput = await page.waitForSelector('[data-testid="token-address-input"]', {
		visible: true,
		timeout: 5_000,
	})
	await addrInput!.click({ clickCount: 3 })
	await addrInput!.type(contractAddress)

	// Wait for parsing to complete (button text changes from "Awaiting..." to "Import new token")
	await page.waitForSelector('[data-testid="import-token-button"]', { visible: true, timeout: 30_000 })
	await page.waitForFunction(
		() => {
			const btn = document.querySelector('[data-testid="import-token-button"]')
			return btn && getComputedStyle(btn).pointerEvents !== "none"
		},
		{ timeout: 30_000 },
	)

	// Click import
	const importBtn = await page.waitForSelector('[data-testid="import-token-button"]', { visible: true })
	await importBtn!.click()

	// Wait for success toast
	await waitForToast(page, "New token has been added", 30_000)
}

/** Click "Refresh balances" from the token dropdown menu. */
export async function refreshBalances(page: Page): Promise<void> {
	await page.evaluate(() => {
		const dotsButtons = [...document.querySelectorAll("[class*='dots'], [class*='trigger']")]
		for (const btn of dotsButtons) {
			if (btn.closest("[class*='token']")) {
				;(btn as HTMLElement).click()
				return
			}
		}
	})

	const refreshOpt = await page.waitForSelector("text/Refresh balances", { visible: true, timeout: 5_000 })
	await refreshOpt!.click()

	// Wait for refresh to complete (no spinner text)
	await new Promise((r) => setTimeout(r, 2_000))
}

/** Read the displayed balance text from BalanceView. */
export async function getDisplayedBalance(page: Page): Promise<string> {
	return await page.evaluate(() => {
		const balanceEl = document.querySelector("[class*='balance'], [class*='amount']")
		return balanceEl?.textContent?.trim() || ""
	})
}

// ── Toast ──────────────────────────────────────────────────────────────

/** Wait for a toast notification containing the given text. Toasts auto-dismiss in ~2s. */
export async function waitForToast(page: Page, text: string, timeout = 5_000): Promise<void> {
	await page.waitForFunction((t: string) => document.body.innerText.includes(t), { timeout, polling: 200 }, text)
}
