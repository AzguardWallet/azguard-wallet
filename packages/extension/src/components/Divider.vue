<script setup>
const slots = defineSlots()
</script>

<template>
	<Flex align="center">
		<div :class="$style.bar" />
		<div v-if="slots.default" :class="$style.txt">
			<slot />
		</div>
		<div :class="$style.bar" />
	</Flex>
</template>

<style module>
.bar {
	width: 100%;
	height: 1px;

	background: var(--nulo-surface-high);
}

.txt {
	white-space: nowrap;

	margin: 0 4px;
}
</style>
