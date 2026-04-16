<script setup>
const props = defineProps({
	icon: String,
	materialIcon: String,
	iconColor: String, // legacy — ignored, API compat only
	title: {
		type: String,
		required: true,
	},
	description: String,
})
</script>

<template>
	<Flex direction="column" align="center" gap="12" :class="$style.wrapper">
		<div :class="$style.icon_container">
			<div :class="$style.icon_box">
				<MaterialIcon v-if="materialIcon" :name="materialIcon" :size="24" color="secondary" />
				<Icon v-else-if="icon" :name="icon" size="20" color="secondary" />
			</div>

			<slot name="rightdownicon" />
		</div>

		<Flex align="center" direction="column" gap="6">
			<h2 :class="$style.title">{{ title }}</h2>

			<p v-if="description" :class="$style.description">{{ description }}</p>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	padding: 8px 0 8px 0;
}

.icon_container {
	position: relative;
}

.icon_box {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 48px;
	height: 48px;

	background: var(--nulo-surface);
	border: 1px solid var(--nulo-border);
}

.title {
	font-family: var(--font-headline);
	font-size: 18px;
	font-weight: 600;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
	text-align: center;
	margin: 0;

	max-width: 280px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.description {
	font-family: var(--font-body);
	font-size: 12px;
	line-height: 1.4;
	color: var(--nulo-secondary);
	text-align: center;
	margin: 0;

	max-width: 280px;
	word-break: break-all;
}
</style>
