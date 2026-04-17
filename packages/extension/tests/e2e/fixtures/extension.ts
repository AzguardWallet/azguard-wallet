import puppeteer, { type Browser, type Page, type ConsoleMessage } from "puppeteer"
import { test as base, inject } from "vitest"
import { switchToLocalNetwork, importToken, getAccountAddress, refreshBalances } from "./helpers"
import type { AztecTestConfig } from "./aztec"

export interface ExtensionContext {
	browser: Browser
	extensionId: string
	consoleErrors: string[]
	pageErrors: Error[]
}

/** Launch a fresh browser with the extension and wait for SW liveness. */
async function launchExtension(): Promise<ExtensionContext> {
	const extensionPath = inject("extensionPath")

	const browser = await puppeteer.launch({
		headless: false,
		args: [
			`--disable-extensions-except=${extensionPath}`,
			`--load-extension=${extensionPath}`,
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--window-size=400,600",
		],
		ignoreDefaultArgs: ["--disable-extensions"],
	})

	// Discover extension ID from service worker target
	const workerTarget = await browser.waitForTarget(
		(target) => target.type() === "service_worker" && target.url().includes("service-worker-loader"),
		{ timeout: 10_000 },
	)
	const extensionId = new URL(workerTarget.url()).hostname

	// Wait for SW to fully initialize (liveness heartbeat in chrome.storage.session)
	const pages = await browser.pages()
	const blankPage = pages[0]
	await blankPage.goto(`chrome-extension://${extensionId}/src/popup/index.html`, {
		waitUntil: "domcontentloaded",
	})
	await blankPage.waitForFunction(
		async () => {
			try {
				const result = await chrome.storage.session.get("nulo:liveness")
				return !!result["nulo:liveness"]
			} catch {
				return false
			}
		},
		{ timeout: 15_000, polling: 500 },
	)
	await blankPage.goto("about:blank")

	return { browser, extensionId, consoleErrors: [], pageErrors: [] }
}

/** Register a profile with a test password. Leaves the extension on #/popup/general. */
async function registerProfile(ctx: ExtensionContext): Promise<void> {
	const page = await openPopup(ctx)

	await waitForHash(page, "#/popup/register")

	// Wait for GlobalLoader to disappear (SW must connect first)
	await page.waitForFunction(
		() => !document.body.innerText.includes("Connecting to service worker") && !document.body.innerText.includes("Reconnecting"),
		{ timeout: 15_000, polling: 500 },
	)

	// Click the actual <button> element (not a descendant text node)
	await clickButtonByText(page, "Create Profile")

	// Wait for RegisterPopup to mount (shows "Create with Password" button)
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

	const testPassword = "TestPassword123!"
	await typeIntoInput(page, "Strong password", testPassword)
	await typeIntoInput(page, "Repeat password", testPassword)

	await page.waitForFunction(
		() => {
			const buttons = [...document.querySelectorAll("button")]
			const btn = buttons.find((b) => b.textContent?.includes("Create with Password"))
			return btn && !btn.disabled
		},
		{ timeout: 5_000 },
	)

	await clickButtonByText(page, "Create with Password")

	await waitForHash(page, "#/popup/general", 15_000)
	await page.waitForSelector('[data-testid="account-selector"]', { visible: true, timeout: 10_000 })
	await page.close()
}

/** Connect a dapp to the wallet via the test dapp page. */
async function connectDapp(ctx: ExtensionContext): Promise<void> {
	const dappPage = await ctx.browser.newPage()
	// TODO: Replace with local @nulo/playground once wallet-sdk connection flow is implemented
	// await dappPage.goto("http://localhost:5174/", {
	await dappPage.goto("https://adhoc-aztec-wallet-test.pages.dev/", {
		waitUntil: "domcontentloaded",
	})

	// Wait for the dapp to be ready
	await dappPage.waitForSelector("text/Ready. Click Connect to start.", {
		visible: true,
		timeout: 15_000,
	})

	// Start listening for the approval window BEFORE clicking Connect
	const approvalTargetPromise = ctx.browser.waitForTarget((t) => t.type() === "page" && t.url().includes("#/windows/connect"), {
		timeout: 15_000,
	})

	// Click the Connect button on the dapp page
	const connectBtn = await dappPage.waitForSelector("text/Connect", { visible: true })
	await connectBtn!.click()

	// Wait for the approval window to open and get its page
	const approvalTarget = await approvalTargetPromise
	const approvalPage = await approvalTarget.asPage()

	// Wait for the connection request UI to fully load with accounts
	await approvalPage.waitForSelector("text/Connection request", {
		visible: true,
		timeout: 15_000,
	})

	// Wait for account list to load, then click the first account (identified by address)
	const accountItem = await approvalPage.waitForSelector("text/0x", {
		visible: true,
		timeout: 10_000,
	})
	await accountItem!.click()

	// Wait for Approve button to become enabled (needs at least one account selected)
	await approvalPage.waitForFunction(
		() => {
			const buttons = [...document.querySelectorAll("button")]
			const btn = buttons.find((b) => b.textContent?.includes("Approve"))
			return btn && !btn.disabled
		},
		{ timeout: 5_000 },
	)

	const approveBtn = await approvalPage.waitForSelector("text/Approve", { visible: true })
	await approveBtn!.click()

	// Wait for dapp to confirm the connection succeeded
	await dappPage.waitForFunction(() => document.body.innerText.includes("Connected!"), { timeout: 15_000 })

	await dappPage.close()
}

// ── Fixtures ────────────────────────────────────────────────────────────

export const test = base.extend<{
	/** Fresh browser with extension loaded, no profile. */
	extension: ExtensionContext
	/** Fresh browser with extension + registered profile on #/popup/general. */
	registeredExtension: ExtensionContext
	/** Registered extension + dapp connected via test dapp page. */
	dappConnectedExtension: ExtensionContext
	/** Registered + switched to Local Network. */
	localNetworkExtension: ExtensionContext
	/** Local network + token imported + public tokens minted to account. */
	tokenReadyExtension: ExtensionContext & { accountAddress: string }
	/** Token ready + FeeJuice bridged and claimed to account. */
	feeJuiceReadyExtension: ExtensionContext & { accountAddress: string }
}>({
	extension: [
		// biome-ignore lint/correctness/noEmptyPattern: vitest fixture API requires {} destructuring
		async ({}, use) => {
			const ctx = await launchExtension()
			await use(ctx)
			await ctx.browser.close()
		},
		{ scope: "file" },
	],

	registeredExtension: [
		// biome-ignore lint/correctness/noEmptyPattern: vitest fixture API requires {} destructuring
		async ({}, use) => {
			const ctx = await launchExtension()
			await registerProfile(ctx)
			await use(ctx)
			await ctx.browser.close()
		},
		{ scope: "file" },
	],

	dappConnectedExtension: [
		async ({ registeredExtension }, use) => {
			await connectDapp(registeredExtension)
			await use(registeredExtension)
		},
		{ scope: "file" },
	],

	localNetworkExtension: [
		// biome-ignore lint/correctness/noEmptyPattern: vitest fixture API requires {} destructuring
		async ({}, use) => {
			const ctx = await launchExtension()
			await registerProfile(ctx)
			const page = await openPopup(ctx)
			await waitForHash(page, "#/popup/general", 15_000)
			await switchToLocalNetwork(page)
			await page.close()
			await use(ctx)
			await ctx.browser.close()
		},
		{ scope: "file" },
	],

	tokenReadyExtension: [
		// biome-ignore lint/correctness/noEmptyPattern: vitest fixture API requires {} destructuring
		async ({}, use) => {
			const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
			if (!aztecConfig) throw new Error("aztecTestConfig not provided — is the local Aztec node running?")

			const ctx = await launchExtension()
			await registerProfile(ctx)

			const page = await openPopup(ctx)
			await waitForHash(page, "#/popup/general", 15_000)
			await switchToLocalNetwork(page)

			const accountAddress = await getAccountAddress(page)
			console.log("[tokenReady] Extension account address:", accountAddress)
			console.log("[tokenReady] Token address:", aztecConfig.tokenAddress)

			// Lazy import to avoid loading WASM for smoke tests (Lesson #4)
			const { createTestWallet, createSponsoredFeeOptions, mintPublicTokens } = await import("./aztec")
			let walletCleanup: (() => Promise<void>) | undefined
			try {
				const { wallet, cleanup } = await createTestWallet(aztecConfig.nodeUrl)
				walletCleanup = cleanup
				const feeOptions = await createSponsoredFeeOptions(wallet)
				await mintPublicTokens(
					wallet,
					aztecConfig.tokenAddress,
					accountAddress,
					1000n * 10n ** 18n,
					aztecConfig.minterAddress,
					feeOptions,
				)
			} finally {
				await walletCleanup?.()
			}

			await importToken(page, aztecConfig.tokenAddress)

			// Poll: refresh balances until the minted amount is visible in the extension.
			// The extension's PXE syncs blocks independently and may take 1-2 minutes
			// on a fresh node. Each refresh triggers a simulateTx which advances the sync.
			const maxRetries = 30
			for (let i = 0; i < maxRetries; i++) {
				await refreshBalances(page)
				const bodyText = await page.evaluate(() => document.body.innerText)
				if (bodyText.includes("1,000")) {
					console.log(`[tokenReady] Balance visible after ${i + 1} refresh(es) (~${(i + 1) * 5}s)`)
					break
				}
				if (i % 5 === 4) {
					console.log(`[tokenReady] Still waiting for balance... (${i + 1}/${maxRetries} retries)`)
				}
				if (i === maxRetries - 1) {
					console.warn("[tokenReady] Balance not visible after all retries (~150s) — tests may fail")
				}
				await new Promise((r) => setTimeout(r, 5_000))
			}

			await page.close()

			await use(Object.assign(ctx, { accountAddress }))
			await ctx.browser.close()
		},
		{ scope: "file" },
	],

	feeJuiceReadyExtension: [
		// biome-ignore lint/correctness/noEmptyPattern: vitest fixture API requires {} destructuring
		async ({}, use) => {
			const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
			if (!aztecConfig) throw new Error("aztecTestConfig not provided — is the local Aztec node running?")

			const ctx = await launchExtension()
			await registerProfile(ctx)

			const page = await openPopup(ctx)
			await waitForHash(page, "#/popup/general", 15_000)
			await switchToLocalNetwork(page)

			const accountAddress = await getAccountAddress(page)
			console.log("[feeJuiceReady] Extension account address:", accountAddress)

			const { createTestWallet, createSponsoredFeeOptions, mintPublicTokens, bridgeFeeJuice, waitForL1ToL2Message, claimFeeJuice } =
				await import("./aztec")
			let walletCleanup: (() => Promise<void>) | undefined
			try {
				const { wallet, accounts, node, cleanup } = await createTestWallet(aztecConfig.nodeUrl)
				walletCleanup = cleanup
				const minterAddress = accounts[0]
				const feeOptions = await createSponsoredFeeOptions(wallet)

				// Mint tokens (same as tokenReadyExtension)
				await mintPublicTokens(
					wallet,
					aztecConfig.tokenAddress,
					accountAddress,
					1000n * 10n ** 18n,
					aztecConfig.minterAddress,
					feeOptions,
				)

				// Bridge FeeJuice from L1 → L2
				console.log("[feeJuiceReady] Bridging FeeJuice from L1...")
				const claim = await bridgeFeeJuice(node, accountAddress)

				// Wait for L1→L2 message to arrive on L2
				console.log("[feeJuiceReady] Waiting for L1→L2 message...")
				await waitForL1ToL2Message(node, claim.messageHash.toString(), 90_000)

				// Claim FeeJuice on L2 (use SponsoredFPC to pay for the claim tx)
				console.log("[feeJuiceReady] Claiming FeeJuice on L2...")
				await claimFeeJuice(wallet, accountAddress, minterAddress, claim, feeOptions)
				console.log("[feeJuiceReady] FeeJuice claimed successfully")
			} finally {
				await walletCleanup?.()
			}

			await importToken(page, aztecConfig.tokenAddress)

			// Poll for token balance
			const maxRetries = 30
			for (let i = 0; i < maxRetries; i++) {
				await refreshBalances(page)
				const bodyText = await page.evaluate(() => document.body.innerText)
				if (bodyText.includes("1,000")) {
					console.log(`[feeJuiceReady] Balance visible after ${i + 1} refresh(es)`)
					break
				}
				if (i === maxRetries - 1) {
					console.warn("[feeJuiceReady] Balance not visible after all retries")
				}
				await new Promise((r) => setTimeout(r, 5_000))
			}

			await page.close()
			await use(Object.assign(ctx, { accountAddress }))
			await ctx.browser.close()
		},
		{ scope: "file" },
	],
})

// ── Helpers ─────────────────────────────────────────────────────────────

/** Open the extension popup in a new page with error collection. */
export async function openPopup(ctx: ExtensionContext): Promise<Page> {
	const page = await ctx.browser.newPage()
	await page.setViewport({ width: 360, height: 600 })

	ctx.consoleErrors = []
	ctx.pageErrors = []

	page.on("console", (msg: ConsoleMessage) => {
		if (msg.type() === "error") {
			ctx.consoleErrors.push(msg.text())
		}
	})

	page.on("pageerror", (err: Error) => {
		ctx.pageErrors.push(err)
	})

	const popupUrl = `chrome-extension://${ctx.extensionId}/src/popup/index.html`
	await page.goto(popupUrl, { waitUntil: "domcontentloaded" })

	return page
}

/** Wait for Vue hash router to reach the expected hash. */
export async function waitForHash(page: Page, expectedHash: string, timeout = 5_000): Promise<void> {
	await page.waitForFunction((hash: string) => window.location.hash === hash, { timeout }, expectedHash)
}

/** Type into an input found by placeholder. */
export async function typeIntoInput(page: Page, placeholder: string, text: string): Promise<void> {
	const input = await page.waitForSelector(`input[placeholder="${placeholder}"]`, {
		visible: true,
		timeout: 10_000,
	})
	await input!.click({ clickCount: 3 })
	await input!.type(text)
}

/** Click a visible enabled button by its text content.
 *  Uses page.evaluate to find the actual <button> element, avoiding
 *  stale references from Puppeteer's text/ selector matching descendant nodes. */
export async function clickButtonByText(page: Page, text: string, timeout = 10_000): Promise<void> {
	await page.waitForFunction(
		(label: string) => {
			const button = [...document.querySelectorAll("button")].find((b) => {
				const normalized = b.textContent?.replace(/\s+/g, " ").trim()
				if (normalized !== label) return false
				const style = window.getComputedStyle(b)
				const rect = b.getBoundingClientRect()
				return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
			})
			if (!button) return false
			button.click()
			return true
		},
		{ timeout },
		text,
	)
}
