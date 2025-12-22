import { ConfigServiceClient } from "@/wallet/services/config/client"
import privacyPlaceholder from "@/assets/privacy-placeholder.svg"

/** Service */
const configService = new ConfigServiceClient()

/**
 * Handles external image loading based on uploadExternalImages config setting:
 * - enabled: loads external image normally
 * - disabled: returns privacy placeholder
 */
export function useExternalImage() {
	// Cleanup on component unmount
	onBeforeUnmount(() => {
		configService.disconnect()
	})

	/**
	 * Load external image with privacy check
	 * @param {string} url - external image URL
	 * @returns {Promise<string|undefined>} - blob URL or placeholder path
	 */
	async function loadExternalImage(url) {
		if (!url) return undefined

		const isEnabled = await configService.getValue("uploadExternalImages")

		if (!isEnabled) {
			return privacyPlaceholder
		}

		// Load external image as blob
		try {
			const res = await fetch(url, { mode: "cors" })
			if (!res.ok) return undefined

			const blob = await res.blob()
			return URL.createObjectURL(blob)
		} catch {
			return undefined
		}
	}

	return { loadExternalImage, privacyPlaceholder }
}
