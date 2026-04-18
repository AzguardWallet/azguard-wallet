<script setup>
defineProps({
	label: {
		type: String,
		required: true,
	},
	count: {
		type: [String, Number],
		default: null,
	},
})
</script>

<template>
	<div :class="$style.wrapper">
		<span>{{ label }}</span>
		<span v-if="count !== null" :class="$style.count">{{ count }}</span>
	</div>
</template>

<style module>
.wrapper {
	display: flex;
	align-items: baseline;
	gap: 10px;

	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.count {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-outline);
}
</style>
