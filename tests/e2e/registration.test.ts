import { describe, it, expect } from "vitest"
import { useExtension, openPopup, waitForHash, typeIntoInput } from "./fixtures/extension"

describe("Registration Flow", () => {
    const ctx = useExtension()

    it("fresh install shows register page", async () => {
        const page = await openPopup(ctx)

        await waitForHash(page, "#/popup/register")

        await page.waitForSelector("text/Create Profile", { visible: true })
        await page.waitForSelector("text/Import Profile", { visible: true })
    })

    it("create profile with password", async () => {
        const page = await openPopup(ctx)
        await waitForHash(page, "#/popup/register")

        // Click "Create Profile" to open the password overlay
        const createBtn = await page.waitForSelector("text/Create Profile", { visible: true })
        await createBtn!.click()

        // Wait for password overlay to slide in
        await page.waitForSelector('input[placeholder="Strong password"]', {
            visible: true,
            timeout: 10_000,
        })

        // Fill passwords (≥8 chars, matching)
        const testPassword = "TestPassword123!"
        await typeIntoInput(page, "Strong password", testPassword)
        await typeIntoInput(page, "Repeat password", testPassword)

        // Wait for submit button to become enabled
        await page.waitForFunction(() => {
            const buttons = [...document.querySelectorAll("button")]
            const btn = buttons.find((b) => b.textContent?.includes("Create with Password"))
            return btn && !btn.disabled
        }, { timeout: 5_000 })

        // Submit
        const submitBtn = await page.waitForSelector("text/Create with Password", { visible: true })
        await submitBtn!.click()

        // Wait for async navigation to general page
        await waitForHash(page, "#/popup/general", 60_000)

        // Verify post-registration state — proves the flow actually produced a valid account
        await page.waitForSelector("text/Account", { visible: true, timeout: 10_000 })

        // Network indicator present
        await page.waitForSelector("text/Devnet", { visible: true })

        // Action buttons rendered
        await page.waitForSelector("text/Send", { visible: true })
        await page.waitForSelector("text/Receive", { visible: true })

        // Bottom navigation tabs present
        const navLinks = await page.evaluate(() => {
            const links = [...document.querySelectorAll("a")]
            return links
                .map((a) => a.getAttribute("href"))
                .filter((h) => h?.includes("#/popup/"))
        })
        expect(navLinks).toContain("#/popup/activity")
        expect(navLinks).toContain("#/popup/general")
        expect(navLinks).toContain("#/popup/settings")

        // Assert no unexpected console errors
        expect(ctx.consoleErrors).toEqual([])
        expect(ctx.pageErrors).toEqual([])
    })
})
