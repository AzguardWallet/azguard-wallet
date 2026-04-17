<script setup>
const props = defineProps({
	emojis: {
		type: String,
		required: true,
	},
})

const rows = computed(() => {
	const chars = [...props.emojis]
	return [chars.slice(0, 3), chars.slice(3, 6), chars.slice(6, 9)]
})
</script>

<template>
	<Flex direction="column" align="center" gap="4" :class="$style.grid">
		<Flex v-for="(row, i) in rows" :key="i" align="center" justify="center" gap="4">
			<Flex
				v-for="(emoji, j) in row"
				:key="j"
				align="center"
				justify="center"
				:class="$style.cell"
			>
				<Text size="24">{{ emoji }}</Text>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.grid {
	padding: 8px;
}

.cell {
	width: 48px;
	height: 48px;

	border-radius: 0;
	background: var(--nulo-surface-low);
	border: 1px solid var(--nulo-border);
}
</style>
