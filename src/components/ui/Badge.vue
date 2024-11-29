<script setup>
const props = defineProps({
	variant: {
		type: String,
		default: "info",
	},
})
</script>

<template>
	<Flex align="center" gap="6" :class="[$style.wrapper, $style[variant]]">
		<slot />
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 6px;
	padding: 2px 4px;

	&.info {
		background: var(--gray-5);
		color: var(--txt-primary);
	}

	&.warning {
		background: var(--orange);
		color: var(--txt-inverse);
	}

	&.error {
		background: var(--red);
		color: var(--txt-inverse);
	}
}
</style>
