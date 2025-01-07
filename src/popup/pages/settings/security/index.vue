<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
</script>

<template>
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Settings </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Security </Text>
		</Flex>

		<Flex direction="column" gap="8">
			<RouterLink to="/popup/settings/security/wallet">
				<Flex align="center" justify="between" :class="$style.item">
					<Flex direction="column" gap="6">
						<Text size="14" weight="600" color="primary"> Wallet </Text>
						<Text size="13" weight="500" color="tertiary"> Edit or reset your wallet </Text>
					</Flex>

					<Icon name="chevron" size="16" color="tertiary" :class="$style.item_icon" />
				</Flex>
			</RouterLink>

			<RouterLink to="/popup/settings/security/accounts">
				<Flex align="center" justify="between" :class="$style.item">
					<Flex direction="column" gap="6">
						<Text size="14" weight="600" color="primary"> Manage accounts </Text>
						<Text size="13" weight="500" color="tertiary"> Edit account visibility or metadata </Text>
					</Flex>

					<Icon name="chevron" size="16" color="tertiary" :class="$style.item_icon" />
				</Flex>
			</RouterLink>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
