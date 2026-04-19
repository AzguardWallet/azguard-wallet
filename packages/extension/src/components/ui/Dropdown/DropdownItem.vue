<script setup>
defineProps({
	disabled: Boolean,
})
</script>

<template>
	<div :class="[$style.wrapper, disabled && $style.disabled]" tabindex="1">
		<slot />
	</div>
</template>

<style module>
.wrapper {
	display: flex;
	align-items: center;

	min-width: 120px;
	padding: 10px 14px;

	transform-style: preserve-3d;
	-webkit-transform-style: preserve-3d;
	backface-visibility: hidden;
	-webkit-backface-visibility: hidden;
	transform: translateZ(0);

	font-size: 13px;
	font-weight: 500;
	line-height: 16px;
	color: var(--txt-primary);
	white-space: nowrap;
	overflow: hidden;

	cursor: pointer;

	transition: background 0.1s var(--bezier);
}

.wrapper.disabled {
	opacity: 0.5;
	cursor: not-allowed;
	pointer-events: none;
}

.wrapper:hover {
	background: var(--nulo-surface-low);
}

.wrapper:focus {
	outline: none;
	background: var(--nulo-surface-low);
}
</style>
