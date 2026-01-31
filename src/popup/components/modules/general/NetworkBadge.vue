<script setup>
/** Utils */
import { getChainColor, getChainName } from "@/components/ui/utils.js"

const props = defineProps({
	network: {
		type: Object,
		required: false,
	},
	chainId: {
		type: Number,
		required: false,
	}
})

const chainName = computed(() => {
	const chainName = getChainName(props.network?.chainId ?? props.chainId)
	if (chainName.startsWith("Aztec:")) {
		return "Custom"
	}
	return chainName
})
</script>

<template>
	<Tooltip position="end" :disabled="!network">
		<Flex
			align="center"
			gap="6"
			:class="$style.wrapper"
			:style="{ background: `var(--${getChainColor(network?.chainId ?? chainId)})` }"
		>
			<Flex v-if="chainName === 'Custom'" align="center" gap="2">
				<Text size="11" weight="700"> {{ chainName }} </Text>
				<div :class="$style.divider" />
				<Text size="10" weight="600"> {{ network?.chainId ?? chainId }} </Text>
			</Flex>

			<Text v-else size="11" weight="700"> {{ chainName }} </Text>
		</Flex>

		<template v-if="network" #content>
			<Flex direction="column" gap="6" align="end">
				<Text> <Text color="secondary">URL:</Text> {{ network?.rpcUrl }} </Text>
				<Text>
					<Text color="secondary">ID:</Text>
					{{ network?.chainId }}
				</Text>
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
