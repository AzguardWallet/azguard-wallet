<script setup>
/**
 * Vendor
 */
import { useCssModule } from "vue"
import { RouterLink } from "vue-router"

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
	const hasCorrectSize = [
		"large",
		"medium",
		"small",
		"mini",
		"dynamic",
	].includes(props.size)

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
		:class="[...getStyles(), loading && $style.loading]"
	>
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

/* Focus */
/* .wrapper.primary:focus-visible {
	box-shadow: 0 0 0 3px rgba(39, 110, 241, 0.4);
}

.wrapper.secondary:focus-visible {
	box-shadow: 0 0 0 2px var(--op-10);
}

.wrapper.tertiary:focus-visible {
	box-shadow: inset 0 0 0 2px var(--op-5), 0 0 0 2px var(--op-10);
} */

.wrapper.loading {
	opacity: 0.5;
	pointer-events: none;
}

.wrapper.wide {
	width: 100%;
	justify-content: center;
}

/** SIZES */
.wrapper.dynamic {
	height: initial;

	border-radius: 12px;

	padding: 10px 0;
}

.wrapper.large {
	height: 44px;
	font-size: 14px;
	line-height: 1;

	border-radius: 12px;
}

.wrapper.medium {
	height: 36px;
	gap: 6px;

	border-radius: 12px;

	padding: 0 12px;
}

.wrapper.small {
	height: 32px;
	gap: 6px;

	border-radius: 10px;

	padding: 0 12px;
}

.wrapper.mini {
	height: 26px;

	gap: 6px;

	border-radius: 6px;

	font-size: 12px;

	padding: 0 8px;
}

/** TYPES */
.wrapper.success {
	background: var(--btn-success-bg);
	fill: var(--txt-black);
	color: var(--txt-black);
}
.wrapper.success:hover {
	background: var(--btn-success-bg-hover);
	box-shadow: 0 0 0 0 transparent;
}

.wrapper.error {
	background: var(--btn-error-bg);
	fill: var(--txt-black);
	color: var(--txt-black);
}
.wrapper.error:hover {
	background: var(--btn-error-bg-hover);
	box-shadow: 0 0 0 0 transparent;
}

.wrapper.primary {
	background: linear-gradient(rgba(0, 0, 0, 90%), rgba(0, 0, 0, 70%));
	box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 20%);
	fill: var(--txt-white);
}

.wrapper.secondary {
	background: var(--gray-5);
}
.wrapper.secondary:hover {
	background: var(--gray-10);
}
.wrapper.secondary:active {
	background: var(--gray-5);
}

.wrapper.tertiary {
	background: transparent;
}
.wrapper.tertiary:hover {
	box-shadow: inset 0 0 0 2px var(--gray-10);
}
.wrapper.tertiary:active {
	background: var(--gray-5);
}

.wrapper.text {
	height: initial;

	color: var(--txt-blue);

	background: transparent;

	padding: 0;

	transition: color 0.2s ease;
}

.wrapper.text:hover {
	color: var(--blue);
}

.wrapper.text.small {
	font-size: 12px;
	line-height: 1;
}

/** OTHER */
.wrapper.disabled {
	pointer-events: none;
	opacity: 0.4;
}

.wrapper.border {
	border: 1px solid var(--border);
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
