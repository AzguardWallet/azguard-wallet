<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
</script>

<template>
	<Flex wide align="center" justify="between">
		<Flex
			@click="popupStore.open('send')"
			align="center"
			justify="center"
			gap="6"
			:class="$style.button"
		>
			<Icon name="arrow-top-right-circle" size="20" color="blue" />
			<Text size="14" weight="600" color="primary">Send</Text>
		</Flex>

		<Flex
			@click="popupStore.open('receive')"
			align="center"
			justify="center"
			gap="6"
			:class="$style.button"
		>
			<Icon name="arrow-bottom-circle" size="20" color="green" />
			<Text size="14" weight="600" color="primary">Receive</Text>
		</Flex>

		<Flex
			align="center"
			justify="center"
			gap="6"
			:class="[$style.button, $style.disabled]"
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
	background: var(--action-btn-bg);
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
			0 1px 3px var(--shadow-5);
	}
}
</style>
