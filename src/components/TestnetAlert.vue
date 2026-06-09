<script setup>
/** Utils */
import { isTestnet } from "@/components/ui/utils.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const isVisible = computed(() => {
	return isTestnet(appStore.network?.chainId)
})
</script>

<template>
	<Flex v-if="isVisible" align="center" justify="center" gap="4" :class="$style.wrapper">
		<Icon name="warning" size="13" color="gray" />
		<Text size="12" weight="600" color="secondary"> You are currently on the test network </Text>
	</Flex>
</template>

<style module>
.wrapper {
	background: repeating-linear-gradient(
		-45deg,
		var(--gray-3),
		var(--gray-3) 2px,
		var(--gray-8) 2px,
		var(--gray-8) 4px
	);
	box-shadow: 0 0 0 2px var(--gray-3);

	padding: 2px 0 4px 0;
}
</style>
