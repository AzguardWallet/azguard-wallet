import { ConfigServiceClient } from "@/wallet/services/config/client"
import type { ExternalLinksMode } from "@/wallet/config/config"

const client = new ConfigServiceClient("shared-config")

export const externalLinks = ref<ExternalLinksMode>()
export const uploadExternalImages = ref<boolean>()

client.onUpdate.add((prop) => {
	if (prop.key === "externalLinks") externalLinks.value = prop.value as ExternalLinksMode
	if (prop.key === "uploadExternalImages") uploadExternalImages.value = prop.value as boolean
})

let initialized = false
export async function initConfigClient() {
	if (initialized) return
	initialized = true
	externalLinks.value = await client.getValue("externalLinks")
	uploadExternalImages.value = await client.getValue("uploadExternalImages")
}
