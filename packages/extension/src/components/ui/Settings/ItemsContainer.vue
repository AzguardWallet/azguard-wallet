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
	<Flex direction="column" gap="12">
		<span v-if="title" :class="$style.title">{{ title }}</span>

		<Flex direction="column" :class="$style.wrapper">
			<slot />
		</Flex>

		<span v-if="description" :class="$style.description">{{ description }}</span>
	</Flex>
</template>

<style module>
.wrapper {
	background: var(--nulo-surface);
	border: 1px solid var(--nulo-border);
	overflow: hidden;
}

.title {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.2em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.description {
	font-family: var(--font-body);
	font-size: 12px;
	line-height: 1.5;
	color: var(--nulo-secondary);
}
</style>
