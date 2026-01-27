import { uploadExternalImages, initConfigClient } from "./configClient"
import privacyPlaceholder from "@/assets/privacy-placeholder.svg"

// Cache: url -> blobUrl or placeholder
const cache = new Map<string, string>()

// Track config state to invalidate cache on change
let lastConfigValue: boolean | undefined

/**
 * Composable for loading external images based on user's privacy config.
 */
export function useExternalImage() {
	/**
	 * Load external image with privacy check and caching.
	 * @param url - external image URL
	 * @returns blob URL if allowed and cached/fetched, placeholder if disabled
	 */
	async function loadExternalImage(url: string): Promise<string | undefined> {
		if (!url) return undefined

		await initConfigClient()

		const configValue = uploadExternalImages.value

		// Invalidate cache if config changed
		if (lastConfigValue !== undefined && lastConfigValue !== configValue) {
			cache.clear()
		}
		lastConfigValue = configValue

		// Config disabled -> return placeholder
		if (!configValue) {
			return privacyPlaceholder
		}

		// Check cache
		const cached = cache.get(url)
		if (cached) {
			return cached
		}

		// Fetch and cache
		try {
			const res = await fetch(url, { mode: "cors" })
			if (!res.ok) return undefined

			const blob = await res.blob()
			const blobUrl = URL.createObjectURL(blob)
			cache.set(url, blobUrl)
			return blobUrl
		} catch {
			return undefined
		}
	}

	return { loadExternalImage, privacyPlaceholder }
}
