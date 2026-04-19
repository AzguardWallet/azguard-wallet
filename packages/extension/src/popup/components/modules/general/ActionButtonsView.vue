<script setup>
/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const router = useRouter()

const props = defineProps({
	token: {
		type: Object,
		required: false,
	},
})

const handleSend = () => {
	// Thread the token via query — tokens/[id] clears cacheStore.activeTokenIdx
	// on unmount, so the cache store alone can't carry the preselection across
	// navigation. Home has no token context; no query → send page picks tokens[0].
	router.push({ path: "/popup/send", query: props.token ? { tokenId: props.token.id } : {} })
}

const handleReceive = () => {
	popupStore.open("receive")
}
</script>

<template>
	<Flex wide align="center" gap="16">
		<Flex @click="handleSend" wide align="center" justify="center" :class="[$style.button, $style.primary]" data-testid="actions-send">
			<span :class="$style.label">SEND</span>
		</Flex>

		<Flex @click="handleReceive" wide align="center" justify="center" :class="[$style.button, $style.secondary]" data-testid="actions-receive">
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
