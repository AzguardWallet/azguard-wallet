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
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
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
				title="Wallet"
				description="Edit or reset your wallet"
				icon="wallet"
				disabled
			/>
		</ItemsContainer>

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
