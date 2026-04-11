<route lang="json">
{
	"meta": {
		"title": "Account State",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<ItemsContainer>
			<SettingItem
				to="/popup/settings/account/state/notes"
				title="Notes"
				description="View all notes"
				chevron
			/>
			<SettingItem
				size="large"
				to="/popup/settings/account/state/authwits"
				title="Authwits"
				description="View all authwits"
				chevron
			/>
			<SettingItem
				size="large"
				to="/popup/settings/account/state/contracts"
				title="Contracts"
				description="View all contracts"
				chevron
			/>
			<SettingItem
				size="large"
				to="/popup/settings/account/state/senders"
				title="Senders"
				description="View all senders"
				chevron
			/>
		</ItemsContainer>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
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

	&.disabled {
		opacity: 0.4;
		pointer-events: none;
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
