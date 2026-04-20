<script setup>
defineProps({
	label: { type: String, required: true },
	sub: { type: String, default: "" },
})
</script>

<template>
	<div :class="$style.wrapper" data-testid="loading-state">
		<Spinner size="20" color="--txt-primary" />
		<span :class="$style.label">{{ label }}</span>
		<span v-if="sub" :class="$style.sub">{{ sub }}</span>
	</div>
</template>

<style module>
.wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;

	padding: 32px 16px;
	border: 1px dashed var(--nulo-border);

	text-align: center;
}

.label {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.sub {
	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-outline);
}
</style>
