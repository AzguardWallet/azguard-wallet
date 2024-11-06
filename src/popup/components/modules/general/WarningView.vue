<template>
	<Flex justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="6">
			<Text size="13" weight="600" color="primary">
				Seed phrase is not saved
			</Text>
			<Text size="12" weight="600" color="tertiary">
				This is the only way to recover your account
			</Text>
		</Flex>

		<Icon name="warning" size="16" color="orange" />
	</Flex>
</template>

<style module>
.wrapper {
	background: #fff;
	border-radius: 12px;
	border: 1px solid var(--gray-10);

	padding: 12px;
}
</style>
