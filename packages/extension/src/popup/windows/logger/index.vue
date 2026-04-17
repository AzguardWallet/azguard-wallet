<script setup>
/** Utils */
import { ProfileServiceClient } from "@/wallet/services/profile/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

let profileService

function onActiveProfileChanged(profile) {
	if (!profile) {
		chrome.windows.getCurrent((window) => {
			chrome.windows.remove(window.id)
		})
	}
}

function onClose() {
	profileService.disconnect()
	profileService = null
	appStore.loggerWindowId = null
}

onMounted(() => {
	profileService = new ProfileServiceClient()
	profileService.onActiveProfileChanged.add(onActiveProfileChanged)
	profileService.connect()
	window.addEventListener("beforeunload", onClose)
})

onUnmounted(() => {
	window.removeEventListener("beforeunload", onClose)
})
</script>

<template>
	<Flex
		align="start"
		direction="column"
		justify="start"
		gap="12"
		:class="[$style.wrapper, $style.json_viewer]"
	>
         <LogsViewer />
	</Flex>
</template>

<style module>
body {
	width: 100%;
	height: 100%;

	background: var(--app-bg);

	margin: 0 auto;
}

.wrapper {
	width: 100%;
	background: var(--app-bg);
}

.json_viewer {
	width: 100%;
	height: 100%;
	max-height: 100%;

	border: 1px solid var(--nulo-border);
	border-radius: 8px;
}
</style>
