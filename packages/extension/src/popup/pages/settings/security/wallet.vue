<route lang="json">
{
	"meta": {
		"title": "Wallet",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<ItemsContainer description="Your wallet can't be restored if you didn't save a seed phrase or secret key ">
			<SettingItem
				@click="popupStore.open('reset')"
				title="Delete entire wallet"
				icon="trash"
				iconBgColor="red"
				chevron
				disabled
			/>
		</ItemsContainer>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);

	padding: 16px 24px var(--nav-clearance) 24px;
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
