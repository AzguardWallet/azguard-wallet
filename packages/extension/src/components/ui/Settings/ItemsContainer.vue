<script setup>
const props = defineProps({
	title: {
		type: String,
		required: false,
	},
	description: {
		type: String,
		required: false,
	},
})
</script>

<template>
	<Flex direction="column" gap="8">
		<Text v-if="title" size="12" weight="500" color="support" :class="$style.title">{{ title }}</Text>

		<Flex direction="column" :class="$style.wrapper">
			<slot />
		</Flex>

		<Text v-if="description" size="12" weight="500" height="150" color="support" :class="$style.description">
			{{ description }}
		</Text>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 12px;
	overflow: hidden;
}

.title {
	padding: 0 12px;
}

.description {
	padding: 0 12px;
}
</style>
