<template>
	<Flex gap="8" :class="$style.wrapper">
		<Icon name="warning" size="16" color="orange" />
		<Flex direction="column" gap="6">
			<Text size="13" weight="600" color="primary"> Azguard Wallet is in alpha testing </Text>
			<Text size="12" weight="600" color="tertiary">
				If you're facing a bug -
				<a href="https://azguardwallet.io/forms/report-issue" target="_blank"> report an issue </a>
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 12px;

	background: repeating-linear-gradient(
		-45deg,
		var(--gray-3),
		var(--gray-3) 5px,
		var(--gray-8) 5px,
		var(--gray-8) 10px
	);
	box-shadow: 0 0 0 3px var(--gray-3);

	padding: 12px;
}
</style>
