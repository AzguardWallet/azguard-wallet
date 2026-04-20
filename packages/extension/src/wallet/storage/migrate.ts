/**
 * Pre-release storage migration.
 *
 * On first run after the upstream-SchnorrAccount migration, wipe any persisted state that
 * references the old Azguard-account addressing scheme. Accounts re-derive from the seed
 * at the upstream-canonical addresses on next unlock; profile + passkey creds survive.
 *
 * This is intentionally destructive; no backwards compat.
 */
const STORAGE_VERSION_KEY = "nulo:core:storage-version"
const CURRENT_VERSION = 2

const KEYS_TO_WIPE = ["nulo:core:accounts", "nulo:core:txs", "nulo:core:tx-cursors", "nulo:core:token-balances"]

const INDEXEDDB_WIPE_PREFIXES = ["pxe/"]
const INDEXEDDB_WIPE_NAMES = ["keyval-store"]

async function deleteDb(name: string): Promise<void> {
	return new Promise<void>((resolve) => {
		const req = indexedDB.deleteDatabase(name)
		req.onsuccess = () => resolve()
		req.onerror = () => resolve()
		req.onblocked = () => resolve()
	})
}

export async function runStorageMigration(log: (msg: string) => void): Promise<void> {
	const result = await chrome.storage.local.get(STORAGE_VERSION_KEY)
	const version = result[STORAGE_VERSION_KEY] as number | undefined
	if (version === CURRENT_VERSION) {
		return
	}
	log(`Storage version ${version ?? "(none)"} → ${CURRENT_VERSION}; wiping legacy account/tx/balance state + PXE DBs.`)

	await chrome.storage.local.remove(KEYS_TO_WIPE)

	try {
		const dbs = await indexedDB.databases()
		for (const db of dbs) {
			if (!db.name) continue
			const shouldWipe = INDEXEDDB_WIPE_NAMES.includes(db.name) || INDEXEDDB_WIPE_PREFIXES.some((p) => db.name!.startsWith(p))
			if (shouldWipe) {
				await deleteDb(db.name)
			}
		}
	} catch (err) {
		log(`IndexedDB wipe skipped: ${String(err)}`)
	}

	await chrome.storage.local.set({ [STORAGE_VERSION_KEY]: CURRENT_VERSION })
	log("Storage migration complete.")
}
