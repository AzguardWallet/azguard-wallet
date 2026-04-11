import { externalLinks, initConfigClient } from "./configClient"

type ConfirmDialog = {
	title: string
	description: string
	confirm_text: string
	confirm_color: string
	callback: () => void
}

/**
 * Composable for handling external links based on user's privacy config.
 */
export function useExternalLink() {
	const { openToast } = useToast()
	const cacheStore = useCacheStore()
	const popupStore = usePopupStore()

	const confirm = cacheStore.confirm as ConfirmDialog

	/**
	 * Handle external link click based on externalLinks config:
	 * - "disabled": copy URL to clipboard, no navigation
	 * - "confirm": show dialog, open on confirm
	 * - "enabled": open directly
	 */
	async function handleExternalLink(event: MouseEvent, url: string) {
		if (!url) return

		event.preventDefault()

		await initConfigClient()

		const mode = externalLinks.value

		if (mode === "enabled") {
			window.open(url, "_blank", "noopener,noreferrer")
			return
		}

		if (mode === "disabled") {
			await window.navigator.clipboard.writeText(url)
			openToast({ label: "Link copied to clipboard", icon: "copy" })
			return
		}

		if (mode === "confirm") {
			confirm.title = "Open External Link?"
			confirm.description = url
			confirm.confirm_text = "Open"
			confirm.confirm_color = "primary"
			confirm.callback = () => {
				window.open(url, "_blank", "noopener,noreferrer")
			}
			popupStore.open("confirm")
		}
	}

	return { handleExternalLink }
}
