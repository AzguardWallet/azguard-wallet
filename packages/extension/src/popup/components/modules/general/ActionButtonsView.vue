<script setup>
/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const props = defineProps({
	token: {
		type: Object,
		required: false,
	},
})

const handleOpenPopup = (target) => {
	popupStore.open(target)
}
</script>

<template>
	<Flex wide align="center" gap="16">
		<Flex @click="handleOpenPopup('send')" wide align="center" justify="center" :class="[$style.button, $style.primary]" data-testid="actions-send">
			<span :class="$style.label">SEND</span>
		</Flex>

		<Flex @click="handleOpenPopup('receive')" wide align="center" justify="center" :class="[$style.button, $style.secondary]" data-testid="actions-receive">
			<span :class="$style.label">RECEIVE</span>
		</Flex>
	</Flex>
</template>

<style module>
.button {
	height: 52px;

	cursor: pointer;
	border-radius: 0;

	transition: all 0.2s var(--bezier);

	&:active {
		transform: scale(0.97);
	}
}

.primary {
	background: var(--nulo-accent);

	&:hover {
		opacity: 0.9;
	}
}

.secondary {
	background: transparent;
	box-shadow: inset 0 0 0 1px var(--nulo-outline);

	&:hover {
		background: var(--nulo-surface-low);
	}
}

.label {
	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.2em;
	text-transform: uppercase;
}

.primary .label {
	color: #0a0908;
}

.secondary .label {
	color: var(--nulo-accent);
}
</style>
