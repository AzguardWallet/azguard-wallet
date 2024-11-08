<template>
	<Flex align="center" gap="8">
		<div :class="$style.bar" />
		<Text size="12" weight="600" color="support">or</Text>
		<div :class="$style.bar" />
	</Flex>
</template>

<style module>
.bar {
	width: 100%;
	height: 2px;

	background: var(--gray-5);
}
</style>
