<script setup>
const props = defineProps({
	label: {
		type: String,
		required: true,
	},
	value: {
		type: String,
		required: true,
	},
	icon: {
		type: String,
		required: false,
	},
	disabled: {
		type: Boolean,
		required: false,
	},
})
</script>

<template>
	<Flex align="center" justify="center" gap="16" :class="[$style.wrapper, disabled && $style.disabled]">
		<Flex direction="column" gap="6" wide>
			<Text size="12" weight="600" color="secondary">{{ label }}</Text>
			<Text size="13" weight="600" color="primary" :class="$style.value">{{ value }}</Text>
		</Flex>

		<Icon v-if="icon" :name="icon" size="14" color="secondary" />
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;

	cursor: pointer;
	background: transparent;

	padding: 14px 16px;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}

	&:active {
		background: var(--nulo-surface-highest);
	}

	&.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	&::after {
		position: absolute;
		bottom: 0;
		left: 16px;
		right: 16px;
		display: block;
		height: 1px;

		background: rgba(74, 70, 63, 0.3);

		content: " ";
	}

	&:last-of-type::after {
		display: none;
	}
}

.value {
	min-width: 100%;
	width: 0;

	overflow: hidden;
	text-overflow: ellipsis;

	white-space: nowrap;
}
</style>
