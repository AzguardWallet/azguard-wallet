<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

/** Utils */
import { getNetworkColor, getNetworkType } from "@/components/ui/utils.js"

const props = defineProps({
	chainId: {
		type: Number,
		required: true,
	},
})

const node = computed(() => appStore.networks.find(n => n.chainId === props.chainId))

const chain = computed(() => {
	const chainType = getNetworkType(props.chainId)
	if (chainType.toLowerCase().includes("custom")) {
		return "Custom"
	}

	return chainType
})
</script>

<template>
	<Tooltip position="end">
		<Flex
			align="center"
			gap="6"
			:class="$style.wrapper"
			:style="{ background: `var(--${getNetworkColor(chainId)})` }"
		>
			<Flex v-if="chain === 'Custom'" align="center" gap="2">
				<Text size="11" weight="700"> {{ chain }} </Text>
				<div :class="$style.divider" />
				<Text size="10" weight="600"> {{ chainId }} </Text>
			</Flex>

			<Text v-else size="11" weight="700"> {{ chain }} </Text>
		</Flex>

		<template #content>
			<Flex direction="column" gap="6" align="end">
				<Text v-if="node"> <Text color="secondary">URL:</Text> {{ node.rpcUrl }} </Text>
				<Text> <Text color="secondary">ID:</Text> {{ chainId }} </Text>
			</Flex>
		</template>
	</Tooltip>
</template>

<style module>
.wrapper {
	border-radius: 6px;
	padding: 2px 4px;
	color: var(--txt-inverse);
}

.divider {
	width: 1px;
	height: 10px;
	background: var(--txt-inverse);

	margin-bottom: 1px;
}
</style>
