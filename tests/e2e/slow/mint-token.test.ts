import { expect } from "vitest"
import { test, openPopup, waitForHash, typeIntoInput } from "../fixtures/extension"

test("mint token via faucet", { timeout: 360_000 }, async ({ registeredExtension }) => {
    const page = await openPopup(registeredExtension)

    // 1. Verify initial state
    await waitForHash(page, "#/popup/general")
    await page.waitForSelector("text/Account Value", { visible: true })
    await page.waitForSelector("text/$0.00", { visible: true })
    await page.waitForSelector("text/New token", { visible: true })

    // 2. Click Deposit → select method modal
    const depositBtn = await page.waitForSelector("text/Deposit", { visible: true })
    await depositBtn!.click()
    await page.waitForSelector("text/Select deposit method", { visible: true, timeout: 10_000 })

    // 3. Click Azguard Faucet → faucet form
    const faucetOption = await page.waitForSelector("text/Azguard Faucet", { visible: true })
    await faucetOption!.click()
    await page.waitForSelector("text/Faucet", { visible: true, timeout: 10_000 })
    await page.waitForSelector('input[placeholder="Name"]', { visible: true })
    await page.waitForSelector('input[placeholder="Symbol"]', { visible: true })
    await page.waitForSelector('input[placeholder="0.00"]', { visible: true })

    // 4. Fill form and click Mint
    await typeIntoInput(page, "Name", "Test Token")
    await typeIntoInput(page, "Symbol", "TST")
    await typeIntoInput(page, "0.00", "100")

    // Wait for Mint button enabled (FeeSettingsCard must finish init first)
    // Note: Button component uses CSS class (pointer-events: none) not HTML disabled attribute
    await page.waitForFunction(() => {
        const buttons = [...document.querySelectorAll("button")]
        const btn = buttons.find((b) => b.textContent?.trim() === "Mint")
        return btn && getComputedStyle(btn).pointerEvents !== "none"
    }, { timeout: 10_000 })

    // Click Mint
    await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("button")]
        const btn = buttons.find((b) => b.textContent?.trim() === "Mint")
        btn?.click()
    })

    // Popup closes, then background starts mint — wait for token card "Minting in progress"
    await page.waitForFunction(
        () => document.body.innerText.includes("Minting in progress"),
        { timeout: 30_000 }
    )

    // 5. Wait for deploy tx — "Latest transaction" section appears
    await page.waitForFunction(
        () => document.body.innerText.includes("Latest transaction"),
        { timeout: 180_000 }
    )

    // 6. Wait for minting to fully complete (no more "Minting" text)
    await page.waitForFunction(
        () =>
            !document.body.innerText.includes("Minting in progress") &&
            !document.body.innerText.includes("Minting more tokens"),
        { timeout: 180_000 }
    )
    await page.waitForSelector("text/Test Token", { visible: true })

    // 7. Verify activity has transactions
    const viewAllBtn = await page.waitForSelector("text/View all", { visible: true })
    await viewAllBtn!.click()
    await waitForHash(page, "#/popup/activity")
    await page.waitForSelector("text/Mint", { visible: true, timeout: 10_000 })

    const txCount = await page.evaluate(() => {
        const links = [...document.querySelectorAll("a")]
        return links.filter((a) => a.href?.includes("aztecscan")).length
    })
    expect(txCount).toBeGreaterThanOrEqual(2)

    // Navigate back to general
    await page.evaluate(() => {
        const link = document.querySelector('a[href="#/popup/general"]') as HTMLElement
        link?.click()
    })
    await waitForHash(page, "#/popup/general")

    // 8. Refresh balances via ⋮ menu near "Tokens" header
    await page.evaluate(() => {
        const tokensHeader = [...document.querySelectorAll("*")].find(
            (el) => el.textContent?.trim() === "Tokens"
        )
        if (tokensHeader) {
            const parent = tokensHeader.parentElement
            const btn = parent?.querySelector("button")
            btn?.click()
        }
    })

    const refreshBtn = await page.waitForSelector("text/Refresh balances", {
        visible: true,
        timeout: 5_000,
    })
    await refreshBtn!.click()

    // Wait for refresh to complete
    await page.waitForFunction(
        () => !document.body.innerText.includes("Refreshing balance"),
        { timeout: 60_000 }
    )

    // 9. Verify balance = 100 TST
    await page.waitForSelector("text/Test Token", { visible: true })
    await page.waitForFunction(
        () => document.body.innerText.includes("100"),
        { timeout: 10_000 }
    )

    // 10. Switch balance display to Test Token
    const balanceHeader = await page.waitForSelector("text/Account Value", { visible: true })
    await balanceHeader!.click()
    await page.waitForSelector("text/Configure the balance display", {
        visible: true,
        timeout: 10_000,
    })

    // Click the Test Token option via dispatchEvent
    await page.evaluate(() => {
        const allElements = [...document.querySelectorAll("*")]
        const candidates = allElements.filter(
            (el) =>
                el.textContent?.includes("Test Token") &&
                el.textContent?.includes("Use token balance")
        )
        if (candidates.length > 0) {
            const target = candidates[candidates.length - 1]
            target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
        }
    })

    // Header shows "TST Balance" (from BalanceView: `{{ symbol }} Balance`)
    await page.waitForSelector("text/TST Balance", { visible: true, timeout: 10_000 })

    // 11. No errors
    expect(registeredExtension.consoleErrors).toEqual([])
    expect(registeredExtension.pageErrors).toEqual([])
})
