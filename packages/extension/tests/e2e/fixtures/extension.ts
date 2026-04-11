import puppeteer, { type Browser, type Page, type ConsoleMessage } from "puppeteer"
import { test as base, inject } from "vitest"

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
				const result = await chrome.storage.session.get("vibeguard:liveness")
				return !!result["vibeguard:liveness"]
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

	const createBtn = await page.waitForSelector("text/Create Profile", { visible: true })
	await createBtn!.click()

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

	const submitBtn = await page.waitForSelector("text/Create with Password", { visible: true })
	await submitBtn!.click()

	await waitForHash(page, "#/popup/general", 15_000)
	await page.waitForSelector("text/Account", { visible: true, timeout: 10_000 })
	await page.close()
}

/** Connect a dapp to the wallet via the test dapp page. */
async function connectDapp(ctx: ExtensionContext): Promise<void> {
	const dappPage = await ctx.browser.newPage()
	// TODO: Replace with local @vibeguard/playground once wallet-sdk connection flow is implemented
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
}>({
	extension: [
		async ({}, use) => {
			const ctx = await launchExtension()
			await use(ctx)
			await ctx.browser.close()
		},
		{ scope: "file" },
	],

	registeredExtension: [
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
