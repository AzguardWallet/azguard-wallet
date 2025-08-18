<script setup>
/**
 * Vendor
 */
import { ref, watch, computed } from "vue"

const emit = defineEmits(["update:modelValue", "focus", "blur", "maxLengthReached"])
const props = defineProps({
	size: {
		type: String,
		default: "medium",
	},
	type: {
		type: String,
	},
	max: {
		type: [String, Number],
	},
	maxLength: {
		type: Number,
		required: false,
	},
	label: {
		type: String,
	},
	leftText: {
		type: String,
		required: false,
	},
	suffix: {
		type: String,
		required: false,
	},
	icon: {
		type: String,
	},
	placeholder: {
		type: String,
		required: true,
	},
	modelValue: {
		type: [String, Number],
	},
	disabled: {
		type: Boolean,
	},
	autofocus: {
		type: Boolean,
		default: false,
	},
	clearable: {
		type: Boolean,
		default: false,
	},
	disablePaste: {
		type: Boolean,
		default: false,
	},
})

const isFocused = ref(false)

const inputEl = ref(null)
defineExpose({ inputEl })

const text = ref(props.modelValue ? props.modelValue : "")
const warning = ref({
	show: false,
	text: "",
})
const fillWarning = (text) => {
	if (text) {
		warning.value = {
			show: true,
			text
		}

		
	} else {
		warning.value.show = false
	}
}

onMounted(() => {
	if (props.autofocus) {
		inputEl.value.focus()
	}
})

watch(
	() => props.modelValue,
	() => {
		text.value = props.modelValue
	},
)

const getInputType = computed(() => {
	if (!!props.type) return props.type
	return "text"
})

const handleInput = () => {
	if (props.disabled) return

	if (!!props.maxLength) {
		fillWarning()
		emit("maxLengthReached", false)

		if (text.value.length > props.maxLength) {
			text.value = text.value.slice(0, props.maxLength)
		}

		if (text.value.length == props.maxLength) {
			fillWarning(`You can’t enter more than ${props.maxLength} characters`)
			emit("maxLengthReached", true)
		}
	}

	if (props.type === "number") {
		emit(
			"update:modelValue",
			Number.isNaN(Number.parseFloat(text.value)) ? text.value : Number.parseFloat(text.value),
		)
	} else {
		emit("update:modelValue", text.value)
	}
}

const handleKeydown = e => {
	if (props.disabled && e.key !== "Tab") e.preventDefault()
	if (props.type === "number") {
		if (e.key === "-") e.preventDefault()
	}
}

const handleClick = () => {
	if (inputEl.value) inputEl.value.focus()
}

const handleFocus = () => {
	isFocused.value = true
	emit("focus")
}

const handleBlur = () => {
	isFocused.value = false
	emit("blur")
}

const handlePaste = e => {
	if (props.disablePaste) {
		e.preventDefault()
		return
	}
	
	if (!!props.maxLength) {
		e.preventDefault()
		const paste = (e.clipboardData || window.clipboardData).getData('text') || ''
		const el = inputEl.value
		const start = el.selectionStart ?? text.value.length
		const end = el.selectionEnd ?? start
		const before = text.value.slice(0, start)
		const after = text.value.slice(end)
		let newText = before + paste + after

		if (newText.length > props.maxLength) {
			newText = newText.slice(0, props.maxLength)
		}

		text.value = newText
		handleInput()

		nextTick(() => {
			const pos = Math.min(start + paste.length, props.maxLength)
			el.setSelectionRange(pos, pos)
		})

		return
	}
}

const handleClear = () => {
	text.value = null
	emit("blur")
}
</script>

<template>
	<Flex direction="column" gap="8">
		<Flex v-if="label" align="center" justify="between">
			<Flex align="center" gap="4">
				<Text size="13" weight="600" color="secondary">{{ label }}</Text>
				<slot name="labelSuffix" />
			</Flex>

			<Transition v-if="warning.show" name="fade">
				<Tooltip position="end">
					<Flex align="center" gap="6">
						<Icon name="warning" size="12" color="yellow" />
						<Text size="12" color="primary"> Maximum length reached </Text>
					</Flex>

					<template #content>
						{{ warning.text }}
					</template>
				</Tooltip>
			</Transition>

			<slot v-else name="right" />
		</Flex>

		<Flex
			ref="base"
			@click="handleClick"
			gap="12"
			:class="[$style.base, isFocused && $style.focused, disabled && $style.disabled, $style[size]]"
		>
			<Flex align="center" gap="6" wide :class="$style.left">
				<Icon v-if="icon" :name="icon" size="16" color="tertiary" />
				<Text v-if="leftText" size="13" weight="600" color="tertiary">{{ leftText }}</Text>

				<input
					ref="inputEl"
					:type="getInputType"
					:max="max"
					v-model="text"
					@input="handleInput"
					@focus="handleFocus"
					@blur="handleBlur"
					@keydown="handleKeydown"
					@paste="handlePaste"
					:placeholder="placeholder"
					spellcheck="false"
				/>
			</Flex>

			<Icon
				v-if="clearable && text"
				@click.stop="handleClear"
				name="close-circle"
				size="14"
				color="tertiary"
				:class="$style.clear_btn"
			/>
			
			<slot v-else name="suffix" />
		</Flex>

		<slot name="bottom" />
	</Flex>
</template>

<style module>
.base {
	display: flex;
	align-items: center;
	justify-content: space-between;

	border-radius: 10px;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 3px var(--shadow-5);
	background: var(--card-bg);
	padding: 0 12px;
	cursor: text;

	transition: all 0.2s ease;
}

.base.medium {
	height: 38px;
}

.base.small {
	height: 28px;
}

.base.mini {
	height: 22px;
	border-radius: 6px;
	input {
		font-size: 12px;
	}
	
}

.base:hover {
	box-shadow: inset 0 0 0 1px var(--border-hovered);
}

.base.focused {
	box-shadow: inset 0 0 0 1px var(--blue), 0 0 0 1px var(--blue);
}

.base.disabled {
	opacity: 0.8;
	background: var(--gray-10);
	pointer-events: none;
}

.base input {
	border: none;
	outline: none;
	width: 100%;
	height: 100%;
	padding: 0;

	font-size: 14px;
	font-weight: 600;
	color: var(--txt-primary);

	text-overflow: ellipsis;
}

.base input::placeholder {
	color: var(--txt-tertiary);
}

.base input::-webkit-outer-spin-button,
.base input::-webkit-inner-spin-button {
	-webkit-appearance: none;
	margin: 0;
}

.left {
	height: 100%;
}

.clear_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
