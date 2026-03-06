<script setup lang="ts">
import { hashToEmoji } from "@aztec/wallet-sdk/crypto"

const props = defineProps<{
	hash: string
}>()

const grid = computed(() => {
	const emojis = [...hashToEmoji(props.hash, 9)]
	return [emojis.slice(0, 3), emojis.slice(3, 6), emojis.slice(6, 9)]
})
</script>

<template>
	<Flex direction="column" align="center" gap="2">
		<Flex v-for="(row, i) in grid" :key="i" align="center" gap="2">
			<Text v-for="(emoji, j) in row" :key="j" :class="$style.emoji_cell">{{ emoji }}</Text>
		</Flex>
	</Flex>
</template>

<style module>
.emoji_cell {
	font-size: 16px;
	line-height: 1;
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 4px;
	background: var(--gray-3);
}
</style>
