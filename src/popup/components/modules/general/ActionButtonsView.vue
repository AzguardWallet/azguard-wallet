<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const props = defineProps({
	token: {
		type: Object,
		required: false,
	},
})

const handleOpenPopup = (target) => {
	popupStore.open(target)

	if (props.token) {
		cacheStore.activeTokenIdx = props.token.id
	} else {
		cacheStore.activeTokenIdx = appStore.tokens[0]?.id
	}
}
</script>

<template>
	<Flex wide align="center" justify="between" gap="12">
		<Flex
			@click="handleOpenPopup('send')"
			wide
			align="center"
			justify="center"
			gap="6"
			:class="$style.button"
		>
			<Icon name="arrow-top-right-circle" size="20" color="blue" />
			<Text size="14" weight="600" color="primary">Send</Text>
		</Flex>

		<Flex
			@click="handleOpenPopup('receive')"
			wide
			align="center"
			justify="center"
			gap="6"
			:class="$style.button"
		>
			<Icon name="arrow-bottom-circle" size="20" color="green" />
			<Text size="14" weight="600" color="primary">Receive</Text>
		</Flex>

		<Flex
			@click="handleOpenPopup('faucet')"
			align="center"
			justify="center"
			gap="6"
			:class="[$style.button]"
		>
			<Icon name="plus-circle" size="20" color="secondary" />
			<Text size="14" weight="600" color="primary">Deposit</Text>
		</Flex>
	</Flex>
</template>

<style module>
.button {
	height: 36px;

	cursor: pointer;
	background: linear-gradient(var(--gray-10), var(--gray-3));
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 3px var(--shadow-5);
	border-radius: 500px;

	padding: 0 12px;

	transition: all 0.2s var(--bezier);

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	&:hover {
		box-shadow: inset 0 0 0 1px var(--border-hovered),
			0 1px 3px var(--shadow-10);
	}
}
</style>
