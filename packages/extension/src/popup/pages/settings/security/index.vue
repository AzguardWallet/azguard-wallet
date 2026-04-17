<route lang="json">
{
	"meta": {
		"title": "Security",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<ItemsContainer>
			<SettingItem
				size="large"
				title="Backup profile"
				description="Get the seed phrase or secret key"
				icon="download"
				to="/popup/settings/security/export"
			/>
			<SettingItem
				size="large"
				title="Privacy Settings"
				description="Control external service connections"
				icon="eye-off"
				to="/popup/settings/external-services"
			/>
		</ItemsContainer>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);

	padding: 16px 24px 96px 24px;
}

.item {
	border-radius: 0;
	border: 1px solid var(--nulo-border);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--nulo-surface-high);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
