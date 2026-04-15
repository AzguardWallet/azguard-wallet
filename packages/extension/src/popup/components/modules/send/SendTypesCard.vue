<script setup>
const props = defineProps({
	token: {
		type: Object,
		required: false,
	},
})

const selectedSendType = defineModel("sendType")
const selectedReceiverType = defineModel("receiverType")

const handleSwitchSendType = () => {
	if (!props.token) return
	if (!props.token.hasPrivateTransfers || !props.token.hasPublicTransfers) return

	selectedSendType.value = selectedSendType.value === "private" ? "public" : "private"
}

const handleSwitchReceiverType = () => {
	if (!props.token) return
	if (!props.token.hasPrivateBalances || !props.token.hasPublicBalances) return

	selectedReceiverType.value = selectedReceiverType.value === "private" ? "public" : "private"
}
</script>

<template>
	<Flex align="center" gap="8" :class="$style.wrapper">
		<Flex
			@click="handleSwitchSendType"
			align="center"
			gap="6"
			data-testid="send-from-type"
			:class="[$style.pill, selectedSendType === 'private' ? $style.pill_private : $style.pill_public]"
		>
			<Icon
				:name="selectedSendType === 'private' ? 'key-square' : 'face'"
				size="14"
				:color="selectedSendType === 'private' ? 'green' : 'orange'"
			/>
			<span :class="$style.pill_label">{{ selectedSendType }}</span>
		</Flex>

		<MaterialIcon name="arrow_forward" :size="14" color="tertiary" />

		<Flex
			@click="handleSwitchReceiverType"
			align="center"
			gap="6"
			data-testid="send-to-type"
			:class="[$style.pill, selectedReceiverType === 'private' ? $style.pill_private : $style.pill_public]"
		>
			<Icon
				:name="selectedReceiverType === 'private' ? 'key-square' : 'face'"
				size="14"
				:color="selectedReceiverType === 'private' ? 'green' : 'orange'"
			/>
			<span :class="$style.pill_label">{{ selectedReceiverType }}</span>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	padding: 8px 0;
}

.pill {
	cursor: pointer;
	padding: 4px 10px;

	transition: all 0.2s var(--bezier);

	&:hover {
		opacity: 0.8;
	}
}

.pill_private {
	background: rgba(20, 174, 92, 0.15);
}

.pill_public {
	background: rgba(255, 85, 0, 0.15);
}

.pill_label {
	font-family: var(--font-headline);
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--txt-primary);
}
</style>
