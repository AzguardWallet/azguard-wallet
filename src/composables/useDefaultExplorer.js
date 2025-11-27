import { ref, onMounted, onBeforeUnmount } from "vue"
import { ConfigServiceClient } from "@/wallet/services/config/client"

/**
 * Composable for accessing the default block explorer setting.
 * Manages a single ConfigServiceClient instance and listens for updates.
 */
export function useDefaultExplorer() {
	const configService = new ConfigServiceClient()
	const defaultExplorer = ref()

	configService.onUpdate.add((setting) => {
		if (setting.key === "defaultExplorer") {
			defaultExplorer.value = setting.value
		}
	})

	onMounted(async () => {
		const configProps = await configService.getProps()
		defaultExplorer.value = configProps.find(p => p.key === "defaultExplorer")?.value
	})

	onBeforeUnmount(() => {
		configService.disconnect()
	})

	return { defaultExplorer }
}
