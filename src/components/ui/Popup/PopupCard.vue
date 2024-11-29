<script setup>
const props = defineProps({
	large: {
		type: Boolean,
		default: false,
	},
	displaceIdx: {
		type: Number,
	},
})
</script>

<template>
	<Flex
		align="center"
		direction="column"
		gap="20"
		:class="[
			$style.wrapper,
			large && $style.large,
			displaceIdx > 1 && $style.displace,
		]"
		:style="{ '--displace': displaceIdx - 1 }"
	>
		<div :class="$style.bar" />
		<slot />
	</Flex>
</template>

<style module>
.wrapper {
	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5), 0 -6px 16px var(--gray-5);

	padding-top: 10px;

	transition: transform 0.2s ease;

	&.large {
		flex: 10;
	}

	&.displace {
		transform: scale(calc(0.99 - (var(--displace) / 100)));
	}
}

.bar {
	width: 80px;
	height: 4px;

	border-radius: 50px;
	background: var(--gray-10);
}
</style>
