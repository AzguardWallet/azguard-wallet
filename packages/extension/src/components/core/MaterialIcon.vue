<script setup>
const props = defineProps({
	name: {
		type: String,
		required: true,
	},
	size: {
		type: [Number, String],
		default: 24,
	},
	color: {
		type: String,
		default: "primary",
	},
	filled: {
		type: Boolean,
		default: false,
	},
})

const style = computed(() => ({
	fontSize: `${props.size}px`,
	fontVariationSettings: `"FILL" ${props.filled ? 1 : 0}, "wght" 300, "GRAD" 0, "opsz" ${props.size}`,
}))
</script>

<template>
	<span class="material-symbols-outlined" :class="[`color--${color}`]" :style="style">{{ name }}</span>
</template>
