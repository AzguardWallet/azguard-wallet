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

const slots = defineSlots()
</script>

<template>
	<Flex align="center" justify="between" gap="16" :class="[$style.wrapper, disabled && $style.disabled]">
		<Text size="12" weight="600" color="secondary">{{ label }}</Text>

		<Flex align="center" gap="8">
			<Text v-if="!slots.value" size="13" weight="600" color="primary" :class="$style.value">{{ value }}</Text>
			<slot name="value" />

			<Icon v-if="icon" :name="icon" size="14" color="tertiary" />
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;

	cursor: pointer;
	background: var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-8);
	}

	&:active {
		background: var(--gray-10);
	}

	&:last-child {
		border-bottom: none;
	}

	&.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	&::after {
		position: absolute;
		bottom: 0;
		left: 12px;
		display: block;
		width: 100%;
		height: 1px;

		background: var(--gray-5);

		content: " ";
	}

	&.withIcon::after {
		left: 50px;
	}

	&:last-of-type::after {
		display: none;
	}
}

.value {
	overflow: hidden;
	text-overflow: ellipsis;

	white-space: nowrap;
}
</style>
