import { ConfigServiceClient } from "@/wallet/services/config/client"

/** Composables */
const { openToast } = useToast()

/** Store */
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

/** Service */
const configService = new ConfigServiceClient()

/**
 * Handles external link clicks based on externalLinks config setting:
 * - "disabled": copy URL to clipboard, no navigation
 * - "confirm": show dialog, open on confirm
 * - "enabled": open directly
 */
export function useExternalLink() {
	// Cleanup on component unmount
	onBeforeUnmount(() => {
		configService.disconnect()
	})

	/**
	 * Handle external link click
	 * @param {MouseEvent} event - click event
	 * @param {string} url - target URL
	 */
	async function handleExternalLink(event, url) {
		if (!url) return

		// Always prevent default first, then decide what to do
		event.preventDefault()

		const mode = await configService.getValue("externalLinks") || "disabled"

		if (mode === "enabled") {
			window.open(url, "_blank", "noopener,noreferrer")
			return
		}

		if (mode === "disabled") {
			await window.navigator.clipboard.writeText(url)
			openToast({ label: "Link copied to clipboard", icon: "copy" }, 2_000)
			return
		}

		if (mode === "confirm") {
			cacheStore.confirm.title = "Open External Link?"
			cacheStore.confirm.description = url
			cacheStore.confirm.confirm_text = "Open"
			cacheStore.confirm.confirm_color = "primary"
			cacheStore.confirm.callback = () => {
				window.open(url, "_blank", "noopener,noreferrer")
			}
			popupStore.open("confirm")
		}
	}

	return { handleExternalLink }
}
