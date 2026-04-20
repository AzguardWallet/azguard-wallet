<script setup>
/**
 * Vendor
 */
import { useCssModule } from "vue"

const emit = defineEmits(["onKeybind"])
const props = defineProps({
	size: {
		type: String,
		default: "medium",
	},
	type: {
		type: String,
		default: "primary",
	},
	wide: {
		type: Boolean,
		default: false,
	},
	disabled: {
		type: Boolean,
	},
	loading: {
		type: Boolean,
	},
	link: {
		type: String,
		required: false,
	},
	target: {
		type: String,
		required: false,
	},
	leftIcon: {
		type: String,
		required: false,
	},
	leftIconColor: {
		type: String,
		required: false,
	},
	rightIcon: {
		type: String,
		required: false,
	},
	rightIconColor: {
		type: String,
		required: false,
	},
})

const style = useCssModule()

const getStyles = () => {
	const hasCorrectSize = ["large", "medium", "small", "mini", "dynamic", "micro"].includes(props.size)

	return [
		style.wrapper,
		style[props.type],
		props.wide && style.wide,
		hasCorrectSize && style[props.size],
		props.disabled && style.disabled,
		props.border && style.border,
	]
}
</script>

<template>
	<component
		:is="link ? RouterLink : 'button'"
		v-bind="{ to: link ? link : null }"
		:target="target"
		:tabindex="disabled ? -1 : 0"
		:class="[...getStyles(), loading && $style.loading]"
	>
		<Spinner v-if="loading" color="--txt-primary" />
		<Icon
			v-if="leftIcon"
			:name="leftIcon"
			size="16"
			:color="leftIconColor ? leftIconColor : 'white'"
			:class="$style.left_icon"
		/>
		<slot />
		<Icon
			v-if="rightIcon"
			:name="rightIcon"
			size="16"
			:color="rightIconColor ? rightIconColor : 'white'"
			:class="$style.right_icon"
		/>
	</component>
</template>

<style module>
.wrapper {
	position: relative;

	overflow: hidden;

	display: flex;
	align-items: center;
	justify-content: center;
	gap: 10px;

	cursor: pointer;
	box-sizing: border-box;
	user-select: none;

	background-clip: padding-box !important;

	color: var(--txt-primary);
	font-weight: 600;
	white-space: nowrap;

	transition: all 0.2s ease;
}

.wrapper.loading {
	opacity: 0.8;
	pointer-events: none;
}

.wrapper.wide {
	width: 100%;
	justify-content: center;
}

/** SIZES */
.wrapper.dynamic {
	height: initial;
	border-radius: 0;
	padding: 10px 0;
}

.wrapper.large {
	height: 48px;
	font-size: 14px;
	line-height: 1;
	border-radius: 0;
	letter-spacing: 0.05em;
}

.wrapper.medium {
	min-height: 40px;
	gap: 8px;
	font-size: 13px;
	border-radius: 0;
	padding: 0 14px;
	letter-spacing: 0.03em;
}

.wrapper.small {
	height: 32px;
	gap: 6px;
	border-radius: 0;
	padding: 0 12px;
}

.wrapper.mini {
	height: 26px;
	gap: 6px;
	border-radius: 0;
	font-size: 12px;
	padding: 0 10px;
}

.wrapper.micro {
	height: 20px;
	gap: 6px;
	border-radius: 0;
	font-size: 11px;
	padding: 0 8px;
}

/** TYPES */
.wrapper.primary {
	background: var(--nulo-accent);
	color: #0a0908;
	fill: #0a0908;
	font-family: var(--font-headline);
	font-weight: 700;
	text-transform: uppercase;
}
.wrapper.primary:hover:not(.disabled):not(.loading) {
	background: #fff;
}
.wrapper.primary:active:not(.disabled):not(.loading) {
	transform: scale(0.98);
}

/** Brutalist outlined variant — same typographic weight as primary
 *  (font-headline + uppercase) but transparent bg with a 2px architectural
 *  edge. Used for second-tier actions where a soft --nulo-surface-high
 *  chip would fight the brutalist CTA language. */
.wrapper.primary_outline {
	background: transparent;
	color: var(--txt-primary);
	fill: var(--txt-primary);
	font-family: var(--font-headline);
	font-weight: 700;
	text-transform: uppercase;
	border: 2px solid var(--nulo-outline);
}
.wrapper.primary_outline:hover:not(.disabled):not(.loading) {
	background: var(--nulo-surface-low);
}
.wrapper.primary_outline:active:not(.disabled):not(.loading) {
	background: var(--nulo-surface-high);
}

.wrapper.secondary {
	background: var(--nulo-surface-high);
	color: var(--txt-primary);
}
.wrapper.secondary:hover:not(.disabled):not(.loading) {
	background: var(--nulo-surface-highest);
}
.wrapper.secondary:active:not(.disabled):not(.loading) {
	background: var(--nulo-surface-low);
}

.wrapper.tertiary {
	background: transparent;
	color: var(--txt-primary);
}
.wrapper.tertiary:hover:not(.disabled):not(.loading) {
	background: var(--nulo-surface-low);
}
.wrapper.tertiary:active:not(.disabled):not(.loading) {
	background: var(--nulo-surface-high);
}

.wrapper.red {
	background: var(--red);
	color: #fff;
	fill: #fff;
}
.wrapper.red:hover:not(.disabled):not(.loading) {
	opacity: 0.9;
}

.wrapper.success {
	background: var(--green);
	color: #0a0908;
	fill: #0a0908;
}
.wrapper.success:hover:not(.disabled):not(.loading) {
	opacity: 0.9;
}

.wrapper.text {
	height: initial;
	color: var(--nulo-accent);
	background: transparent;
	padding: 0;

	transition: color 0.2s ease;
}
.wrapper.text:hover {
	color: #fff;
}
.wrapper.text.small {
	font-size: 12px;
	line-height: 1;
}

/** OTHER */
.wrapper.disabled {
	pointer-events: none;
	opacity: 0.3;
}

.wrapper.border {
	border: 1px solid var(--nulo-outline);
}

.left_icon {
	position: absolute;
	top: 50%;
	left: 8px;
	transform: translateY(-50%);
}

.right_icon {
	position: absolute;
	top: 50%;
	right: 8px;
	transform: translateY(-50%);
}

.wrapper.medium {
	& .left_icon {
		left: 12px;
	}

	& .right_icon {
		right: 12px;
	}
}
</style>
