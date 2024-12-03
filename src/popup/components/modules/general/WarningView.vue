<template>
	<Flex justify="between" :class="$style.wrapper">
		<Flex direction="column" gap="6">
			<Text size="13" weight="600" color="primary">
				Azguard Wallet is in alpha testing
			</Text>
			<Text size="12" weight="600" color="tertiary">
				If you're facing a bug -
				<a
					href="https://azguardwallet.io/forms/report-issue"
					target="_blank"
				>
					report an issue
				</a>
			</Text>
		</Flex>

		<Icon name="warning" size="16" color="orange" />
	</Flex>
</template>

<style module>
.wrapper {
	background: var(--gray-5);
	border-radius: 12px;

	padding: 12px;
}
</style>
