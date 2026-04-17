<script setup>
const props = defineProps({
	modelValue: { type: Boolean, default: false },
	disabled: { type: Boolean, default: false },
	protected: { type: Boolean, default: false },
})
const emit = defineEmits(["update:modelValue"])

const toggle = () => {
	if (props.disabled || props.protected) return

	emit("update:modelValue", !props.modelValue)
}
</script>

<template>
	<div
		@click="toggle"
		:class="[$style.wrapper, modelValue && $style.active]"
		:style="{ background: modelValue ? props.color : '' }"
		tabindex="1"
	>
		<div
			v-if="!disabled"
			:class="[$style.slider, modelValue && $style.active]"
		/>

		<div v-else :class="$style.lock">
			<Icon name="lock" size="12" />
		</div>
	</div>
</template>

<style module>
.wrapper {
	position: relative;

	min-width: 32px;
	height: 20px;

	background: var(--nulo-surface-high);
	border: 1px solid var(--nulo-border);
	cursor: pointer;

	transition: all 0.2s ease;
}

.wrapper:focus {
	outline: none;
}

.slider {
	position: absolute;
	top: 3px;
	left: 3px;

	width: 12px;
	height: 12px;

	background: var(--nulo-secondary);

	transition: all 0.1s ease;
}

.lock {
	display: flex;
	align-items: center;
	justify-content: center;

	height: 100%;

	cursor: not-allowed;
}

.lock svg {
	fill: var(--txt-primary);
}

.wrapper.active {
	background: var(--nulo-accent);
	border-color: var(--nulo-accent);
}

.wrapper.active .slider {
	left: 15px;
	background: #0a0908;
}

.wrapper:active .slider {
	width: 14px;
}

.wrapper.active:active .slider {
	width: 12px;
}
</style>
