/** Persisted preference for which profile to surface on the lock screen and
 *  in the router fallback. Written whenever a profile becomes active
 *  (create / unlock / switch / import); read in app.vue's loadProfile,
 *  auth.vue's onMounted, and the router's guard. */
const LAST_ACTIVE_PROFILE_KEY = "nulo:ui:lastActiveProfile"

export async function getLastActiveProfileId(): Promise<string | undefined> {
	const result = await chrome.storage.local.get(LAST_ACTIVE_PROFILE_KEY)
	return result[LAST_ACTIVE_PROFILE_KEY]
}

export async function setLastActiveProfileId(id: string): Promise<void> {
	await chrome.storage.local.set({ [LAST_ACTIVE_PROFILE_KEY]: id })
}
