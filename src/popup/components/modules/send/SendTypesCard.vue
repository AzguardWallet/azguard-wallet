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
	if (!props.token.hasPrivateTransfers || !props.token.hasPublicTransfers)
		return

	selectedSendType.value =
		selectedSendType.value === "private" ? "public" : "private"
}

const handleSwitchReceiverType = () => {
	if (!props.token) return
	if (!props.token.hasPrivateBalances || !props.token.hasPublicBalances)
		return

	selectedReceiverType.value =
		selectedReceiverType.value === "private" ? "public" : "private"
}
</script>

<template>
	<Flex align="center" gap="8" :class="$style.wrapper">
		<Text size="13" weight="600" color="secondary">From</Text>

		<Flex
			@click="handleSwitchSendType"
			align="center"
			gap="6"
			:class="[$style.type]"
		>
			<Icon
				:name="selectedSendType === 'private' ? 'key-square' : 'face'"
				size="16"
				:color="selectedSendType === 'private' ? 'green' : 'orange'"
			/>
			<Text size="13" weight="600" color="primary" class="capitalize">
				{{ selectedSendType }}
			</Text>
		</Flex>

		<Text size="13" weight="600" color="secondary">to</Text>

		<Flex
			@click="handleSwitchReceiverType"
			align="center"
			gap="6"
			:class="[$style.type]"
		>
			<Icon
				:name="
					selectedReceiverType === 'private' ? 'key-square' : 'face'
				"
				size="16"
				:color="selectedReceiverType === 'private' ? 'green' : 'orange'"
			/>
			<Text size="13" weight="600" color="primary" class="capitalize">
				{{ selectedReceiverType }}
			</Text>
		</Flex>

		<Text size="13" weight="600" color="secondary">destination</Text>
	</Flex>
</template>

<style module>
.wrapper {
	height: 40px;

	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);
	border-radius: 12px;

	padding: 0 12px;
}

.type {
	cursor: pointer;
	background: var(--gray-5);
	box-shadow: inset 0 0 0 1px var(--border);

	border-radius: 6px;

	padding: 4px;
}
</style>
