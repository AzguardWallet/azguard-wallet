<script setup>
/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()
</script>

<template>
	<Flex
		@click="popupStore.open('select_token')"
		align="center"
		justify="between"
		:class="$style.wrapper"
	>
		<Flex align="center" gap="8">
			<Icon name="aztec" size="16" color="primary" />
			<Text size="13" weight="600" color="primary"> AZT </Text>
			<Text size="13" weight="600" color="body"> Aztec Network </Text>
		</Flex>

		<Icon
			name="chevron"
			size="16"
			color="primary"
			style="transform: rotate(-90deg)"
		/>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--shadow-5);
	border-radius: 12px;
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-5);
	}
}
</style>
