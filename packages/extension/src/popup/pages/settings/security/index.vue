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
		<SubPageHeader title="Security" :backTo="'/popup/settings'" />

		<Flex direction="column" gap="20" :class="$style.content">
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
					to="/popup/settings/privacy"
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
