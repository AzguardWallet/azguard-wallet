<script setup>
/** Utils */
import { getNetworkColor, getNetworkType } from "@/components/ui/utils.js"

const props = defineProps({
	chainId: {
		type: Number,
		required: true,
	},
})

const chain = computed(() => {
	const chainType = getNetworkType(props.chainId)
	if (chainType.toLowerCase().includes("custom")) {
		return "Custom"
	}

	return chainType
})

</script>

<template>
	<Flex align="center" gap="6" :class="$style.wrapper" :style="{ background: `var(--${getNetworkColor(chainId)})`}">
		<!-- <Text size="11" weight="700"> {{ chain === 'Custom' ? `${chain} | ${chainId}` : chain }} </Text> -->
		<Flex v-if="chain === 'Custom'" align="center" gap="2">
			<Text size="11" weight="700"> {{  chain }} </Text>
			<div :class="$style.divider" />
			<Text size="10" weight="600"> {{ chainId }} </Text>
		</Flex>
		 
		<Text v-else size="11" weight="700"> {{ chain }} </Text>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 6px;
	padding: 2px 4px;
	color: var(--txt-inverse);

	/* &.mainnet {
		background: var(--green);
		color: var(--txt-inverse);
	}

	&.azguardbox {
		background: var(--blue);
		color: var(--txt-inverse);
	}

	&.devnet {
		background: var(--gray);
		color: var(--txt-inverse);
	}

	&.sandbox {
		background: var(--sand);
		color: var(--txt-inverse);
	}

	&.custom {
		background: var(--purple);
		color: var(--txt-inverse);
	} */
}

.divider {
	width: 1px;
	height: 10px;
	background: var(--txt-inverse);

	margin-bottom: 1px;
}
</style>
