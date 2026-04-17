<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Account State" :backTo="'/popup/settings/account'" />

		<Flex direction="column" gap="20" :class="$style.content">
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
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
	scrollbar-gutter: stable;
}

.content {
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
