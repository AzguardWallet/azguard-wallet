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
	<div :class="$style.grid">
		<div :class="$style.col">
			<span :class="$style.sub_label">From Origin</span>
			<div @click="handleSwitchSendType" data-testid="send-from-type" :class="$style.toggle_pair">
				<span :class="[$style.toggle_btn, selectedSendType === 'private' && $style.toggle_active]">PRIVATE</span>
				<span :class="[$style.toggle_btn, selectedSendType === 'public' && $style.toggle_active]">PUBLIC</span>
			</div>
		</div>

		<div :class="$style.col">
			<span :class="$style.sub_label">To Destination</span>
			<div @click="handleSwitchReceiverType" data-testid="send-to-type" :class="$style.toggle_pair">
				<span :class="[$style.toggle_btn, selectedReceiverType === 'private' && $style.toggle_active]">PRIVATE</span>
				<span :class="[$style.toggle_btn, selectedReceiverType === 'public' && $style.toggle_active]">PUBLIC</span>
			</div>
		</div>
	</div>
</template>

<style module>
.grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
	padding: 4px 0;
}

.col {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.sub_label {
	font-family: var(--font-mono);
	font-size: 9px;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.toggle_pair {
	display: flex;
	cursor: pointer;
	border: 1px solid #231f1c;
}

.toggle_btn {
	flex: 1;
	padding: 8px 0;

	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 500;
	text-transform: uppercase;
	text-align: center;
	color: var(--nulo-secondary);

	transition: all 0.15s ease;

	&:first-child {
		border-right: 1px solid #231f1c;
	}
}

.toggle_active {
	background: var(--nulo-accent);
	color: #0a0908;
	font-weight: 700;
}
</style>
