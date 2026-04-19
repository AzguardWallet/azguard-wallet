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
		<SubPageHeader title="Account State" :backTo="'/popup/settings/advanced'" />

		<Flex direction="column" gap="20" :class="$style.content">
			<ItemsContainer>
				<SettingItem
					size="large"
					to="/popup/settings/advanced/account-state/notes"
					title="Notes"
					description="View all notes"
					materialIcon="note_alt"
					chevron
				/>
				<SettingItem
					size="large"
					to="/popup/settings/advanced/account-state/authwits"
					title="Authwits"
					description="View all authwits"
					materialIcon="verified_user"
					chevron
				/>
				<SettingItem
					size="large"
					to="/popup/settings/advanced/account-state/contracts"
					title="Contracts"
					description="View all contracts"
					materialIcon="receipt_long"
					chevron
				/>
				<SettingItem
					size="large"
					to="/popup/settings/advanced/account-state/senders"
					title="Senders"
					description="View all senders"
					materialIcon="inbox"
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
</style>
