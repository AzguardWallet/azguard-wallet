<script setup>
const props = defineProps(["modelValue", "checked", "disabled"])
const emit = defineEmits(["update:modelValue"])
</script>

<template>
	<Flex
		@click="emit('update:modelValue', !modelValue)"
		@keydown.enter="emit('update:modelValue', !modelValue)"
		gap="10"
		align="center"
		:class="[$style.wrapper, disabled && $style.disabled]"
		tabindex="0"
	>
		<Flex
			align="center"
			justify="center"
			:class="[$style.checkbox, (modelValue || checked) && $style.active]"
		>
			<Icon
				v-if="modelValue || checked"
				name="check"
				size="14"
				color="white"
			/>
		</Flex>

		<slot />
	</Flex>
</template>

<style module>
.wrapper {
	cursor: pointer;

	&:hover {
		.checkbox {
			border-color: var(--gray-10);
		}
	}

	&.disabled {
		cursor: not-allowed;

		& .checkbox {
			opacity: 0.5;
			background: var(--gray-30);
		}
	}
}

.wrapper:focus-visible {
	outline: none;

	.checkbox {
		border: 1px solid var(--gray-15);
	}

	.checkbox.active {
		background: var(--gray-15);
	}
}

.checkbox {
	min-width: 18px;
	min-height: 18px;
	max-width: 18px;
	max-height: 18px;

	border-radius: 6px;
	background: var(--gray-10);

	transition: all 0.1s ease;

	&.active {
		background: var(--blue);
	}
}
</style>
