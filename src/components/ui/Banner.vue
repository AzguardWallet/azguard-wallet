<script setup>
const props = defineProps({
	variant: {
		type: String,
		default: "info",
	},
	text: {
		type: String,
	},
})
</script>

<template>
	<Flex gap="8" :class="[$style.wrapper, $style[variant]]">
		<Flex align="center" justify="center" :class="$style.icon">
			<Icon name="info" size="16" color="secondary" />
		</Flex>

		<Text size="12" weight="600" color="primary" :class="$style.text">
			<slot />
		</Text>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 8px;

	padding: 8px;

	&.info {
		background: var(--gray-5);
	}
}

.icon {
	min-width: 20px;
	min-height: 20px;
	height: 20px;

	box-sizing: content-box;
}

.text {
	line-height: 20px !important;
}
</style>
