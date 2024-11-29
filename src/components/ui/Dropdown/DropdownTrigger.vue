<script setup>
/**
 * Vendor
 */
import { ref, onMounted, onBeforeUnmount } from "vue"

const emit = defineEmits(["toggle"])
const props = defineProps({
	width: {
		type: [String, Number],
		default: 120,
	},
	isOpen: {
		type: Boolean,
	},
})

const triggerEl = ref(null)

const handleFocus = () => {
	triggerEl.value.wrapper.addEventListener("keydown", handleEnterKey)
}

const handleBlur = () => {
	triggerEl.value.wrapper.removeEventListener("keydown", handleEnterKey)
}

const handleEnterKey = (e) => {
	if (e.key !== "Enter") return

	emit("toggle")
}

onMounted(() => {
	if (!triggerEl.value.wrapper) return

	triggerEl.value.wrapper.addEventListener("focus", handleFocus)
	triggerEl.value.wrapper.addEventListener("blur", handleBlur)
})

onBeforeUnmount(() => {
	if (!triggerEl.value.wrapper) return

	triggerEl.value.wrapper.removeEventListener("focus", handleFocus)
	triggerEl.value.wrapper.removeEventListener("blur", handleBlur)
})
</script>

<template>
	<Flex
		ref="triggerEl"
		align="center"
		justify="between"
		:class="$style.wrapper"
		:style="{ width: `${width}px` }"
		tabindex="0"
	>
		<Flex align="center" gap="8">
			<slot />
		</Flex>

		<Icon
			name="chevron"
			size="12"
			color="secondary"
			:style="{ transform: `rotate(${isOpen ? '180deg' : '0'})` }"
		/>
	</Flex>
</template>

<style module>
.wrapper {
	height: 32px;

	box-shadow: inset 0 0 0 1px var(--border);
	border-radius: 10px;
	cursor: pointer;

	padding: 0 12px;

	transition: all 0.2s ease;
}

.wrapper:hover {
	box-shadow: inset 0 0 0 1px var(--border-hovered);
	background: rgba(255, 255, 255, 0.05);
}
</style>
