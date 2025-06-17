<script setup>
/** Vendor */
import { onMounted } from "vue"

/** Components */
import LogsViewer from "@/components/ui/JsonViewer/LogsViewer.vue"

/** Utils */
import { LoggerServiceClient } from "@/wallet/services/logger/client"

// const params = new URLSearchParams(window.location.search)
// const requestId = params.get("requestId")
// const payload = ref()
// const data = computed(() => payload.value?.params.operations)
const logs = ref([])
const onLogAdded = (log) => {
    logs.value.push(log)
}

onBeforeMount(async () => {
    const loggerService = new LoggerServiceClient(undefined, undefined, onLogAdded)
	logs.value = await loggerService.getLogs()
})
onMounted(async () => {
    // const loggerService = new LoggerServiceClient(undefined, undefined, onLogAdded)
	// logs.value = await loggerService.getLogs()
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
		<LogsViewer v-if="logs.length > 10" :logs=logs />
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
