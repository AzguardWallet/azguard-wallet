<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
</script>

<template>
	<Flex align="center" justify="between">
		<Flex
			@click="popupStore.open('send')"
			direction="column"
			align="center"
			gap="8"
			:class="$style.button_wrapper"
		>
			<Flex align="center" justify="center" :class="$style.button">
				<Icon name="arrow-top-right-circle" size="20" color="primary" />
			</Flex>

			<Text size="12" weight="600" color="secondary">Send</Text>
		</Flex>

		<Flex
			direction="column"
			align="center"
			gap="8"
			:class="$style.button_wrapper"
		>
			<Flex align="center" justify="center" :class="$style.button">
				<Icon name="arrow-bottom-circle" size="20" color="primary" />
			</Flex>

			<Text size="12" weight="600" color="secondary">Receive</Text>
		</Flex>

		<Flex
			direction="column"
			align="center"
			gap="8"
			:class="[$style.button_wrapper, $style.disabled]"
		>
			<Flex align="center" justify="center" :class="$style.button">
				<Icon name="plus-circle" size="20" color="blue" />
			</Flex>

			<Text size="12" weight="600" color="secondary">Buy</Text>
		</Flex>

		<Flex
			direction="column"
			align="center"
			gap="8"
			:class="[$style.button_wrapper, $style.disabled]"
		>
			<Flex align="center" justify="center" :class="$style.button">
				<Icon name="swap" size="20" color="green" />
			</Flex>

			<Text size="12" weight="600" color="secondary">Swap</Text>
		</Flex>
	</Flex>
</template>

<style module>
.button_wrapper {
	cursor: pointer;

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	&:hover {
		& .button {
			background: var(--gray-10);
		}
	}

	&:active {
		& .button {
			background: var(--gray-15);
		}
	}
}

.button {
	width: 68px;
	height: 36px;

	background: var(--gray-5);
	border-radius: 500px;

	transition: all 0.2s var(--bezier);
}
</style>
