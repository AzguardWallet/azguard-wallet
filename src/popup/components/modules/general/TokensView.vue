<template>
	<Flex direction="column" gap="12">
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary"> Tokens </Text>
			<Text size="12" weight="600" color="tertiary" class="clickable">
				Manage
			</Text>
		</Flex>

		<Flex align="center" justify="between" :class="$style.card">
			<Flex align="center" gap="12">
				<Flex
					align="center"
					justify="center"
					:class="$style.token_icon"
				>
					<Icon name="aztec" size="20" color="primary" />
				</Flex>

				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">AZT</Text>
					<Text size="12" weight="500" color="tertiary">
						Aztec Network
					</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="end" gap="6">
				<Text size="13" weight="600" color="primary">0</Text>
				<Text size="13" weight="600" color="tertiary">$0.00</Text>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.card {
	background: var(--card-bg);
	border: 1px solid var(--gray-10);
	box-shadow: 0 1px 2px transparent;
	border-radius: 12px;
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		border-color: var(--gray-10);
		box-shadow: 0 1px 2px var(--gray-5);
	}
}

.token_icon {
	width: 32px;
	height: 32px;

	border-radius: 8px;
	background: var(--gray-5);
	box-sizing: border-box;
}
</style>
