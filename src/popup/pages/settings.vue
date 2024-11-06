<script setup>
/** Components */
import Navigation from "../components/Navigation.vue"
</script>

<template>
	<Flex direction="column" justify="between" :class="$style.wrapper">
		123

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: #fff;
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding-top: 20px;
}
</style>
