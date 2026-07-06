import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect } from "vitest"
import type { Page } from "puppeteer"
import { test, openPopup, waitForHash, typeIntoInput } from "./fixtures/extension"

// The fixture backup is generated against the CURRENT build constants (package.json),
// so these tests keep passing across sentinel/version bumps.
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))
const AZTEC_VERSION = pkg.dependencies["@aztec/pxe"] ?? "unknown"
const CURRENT_ORIGIN = { sentinel: pkg.sentinel, walletVersion: pkg.version, aztecVersion: AZTEC_VERSION }

const MASTER_KEY = Buffer.alloc(32, 7).toString("base64")
const PASSWORD = "TestPassword123!"
const fixtureDir = mkdtempSync(join(tmpdir(), "azguard-backup-"))

/** Mirrors export/full.vue: checksum = sha256 hex over the compact JSON, appended last. */
function writeBackupFixture(name: string, data: Record<string, unknown>): string {
    const backup = {
        "wallet-version": pkg.version,
        "aztec-version": AZTEC_VERSION,
        "master-key": MASTER_KEY,
        data,
    }
    const checksum = createHash("sha256").update(JSON.stringify(backup)).digest("hex")
    const path = join(fixtureDir, `${name}.json`)
    writeFileSync(path, JSON.stringify({ ...backup, checksum }, null, 2))
    return path
}

const profileData = (origin?: Record<string, string>) => ({
    id: "e2e1",
    name: "Restored",
    type: "password",
    ...(origin && { origin }),
})

/** register page -> Import Profile -> Full Backup -> pick file -> fill passwords. */
async function startBackupImport(page: Page, fixturePath: string) {
    await waitForHash(page, "#/popup/register")

    const importBtn = await page.waitForSelector("text/Import Profile", { visible: true })
    await importBtn!.click()

    const fullBackup = await page.waitForSelector("text/Full Backup", { visible: true })
    await fullBackup!.click()

    const [chooser] = await Promise.all([
        page.waitForFileChooser(),
        page.waitForSelector("text/Choose a backup file", { visible: true }).then((el) => el!.click()),
    ])
    await chooser.accept([fixturePath])

    await typeIntoInput(page, "Enter new password", PASSWORD)
    await typeIntoInput(page, "Repeat password", PASSWORD)
}

async function clickImportRestored(page: Page) {
    await page.waitForFunction(() => {
        const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Import Restored"))
        return btn && !btn.disabled
    }, { timeout: 5_000 })
    const btn = await page.waitForSelector("text/Import Restored", { visible: true })
    await btn!.click()
}

test("backup without origin is refused as outdated", async ({ extension }) => {
    const fixture = writeBackupFixture("no-origin", { profile: profileData() })
    const page = await openPopup(extension)

    await startBackupImport(page, fixture)
    await clickImportRestored(page)

    await page.waitForSelector("text/Outdated Backup", { visible: true })
    await page.waitForSelector("text/older wallet generation", { visible: true })
})

test("backup from another generation is refused as incompatible", async ({ extension }) => {
    const origin = { sentinel: "0", walletVersion: "0.0.1", aztecVersion: "1.0.0" }
    const fixture = writeBackupFixture("wrong-sentinel", { profile: profileData(origin) })
    const page = await openPopup(extension)

    await startBackupImport(page, fixture)
    await clickImportRestored(page)

    await page.waitForSelector("text/Incompatible Backup", { visible: true })
    await page.waitForSelector("text/different Aztec network generation", { visible: true })
})

test("backup from the current generation restores", async ({ extension }) => {
    const fixture = writeBackupFixture("current", {
        profile: profileData(CURRENT_ORIGIN),
        network: [
            { id: "n1", profileId: "e2e1", name: "Testnet", rpcUrl: "http://localhost:1", chainId: 1, isDefault: true },
        ],
        account: [],
        token: [],
    })
    const page = await openPopup(extension)

    await startBackupImport(page, fixture)
    await clickImportRestored(page)

    // Restore creates the profile without opening a session, so a successful
    // import lands on the unlock screen with the restored profile selected.
    await waitForHash(page, "#/popup/auth", 10_000)
    await page.waitForSelector("text/Restored", { visible: true })
    expect(extension.pageErrors).toEqual([])
})
