<script setup>
defineProps({
	size: {
		type: String,
		default: "12",
	},
})
</script>

<template>
	<Tooltip position="end" delay="200">
		<Icon name="zap" :size color="tertiary" style="margin-bottom: 3px" />
		<template #content>Persistent account</template>
	</Tooltip>
</template>
