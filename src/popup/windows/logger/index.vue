<script setup>
/** Components */
import LogsViewer from "@/components/ui/JsonViewer/LogsViewer.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

function onClose() {
	appStore.loggerWindowId = null
}

onMounted(() => {
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
	background: var(--card-bg);
}

.json_viewer {
	width: 100%;
	height: 100%;
	max-height: 100%;

	box-shadow: 0 0 0 1px var(--gray-5);
	border-radius: 8px;
}
</style>
