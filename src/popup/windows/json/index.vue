<script setup>
/** Vendor */
import { onMounted } from "vue"

/** Components */
import JsonViewer from "@/components/ui/JsonViewer/JsonViewer.vue"

/** Utils */
import { DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"

const params = new URLSearchParams(window.location.search)
const requestId = params.get("requestId")
const payload = ref()
const data = computed(() => payload.value?.params.operations)

onMounted(async () => {
	payload.value = await new DappInteractionServiceClient().getInteractionPayload(requestId)
})
</script>

<template>
	<Flex
		v-if="data"
		align="start"
		direction="column"
		justify="start"
		gap="12"
		:class="[$style.wrapper, $style.json_viewer]"
	>
		<JsonViewer :data="data" fullscreen />
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
