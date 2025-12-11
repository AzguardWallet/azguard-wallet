<route lang="json">
{
	"meta": {
		"title": "Backup",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex direction="column" gap="24" :class="$style.wrapper">
		<Breadcrumbs hide-title />

		<Flex v-if="appStore.profile.type === 'passkey'" direction="column" gap="24">
			<Flex direction="column" align="center" gap="16" :class="$style.page_header">
				<Flex :class="$style.page_icon">
					<Icon name="download" size="24" color="primary" />
					<div />
				</Flex>

				<Flex align="center" direction="column" gap="8">
					<Text size="14" weight="600" color="primary">Backup </Text>
					<Text size="13" weight="500" height="150" color="tertiary" align="center" style="padding: 0 24px">
						Your profile is protected with a <Text weight="600" color="secondary">Passkey</Text>.
					</Text>
				</Flex>
			</Flex>

			<ItemsContainer title="Profile">
				<SettingItem :title="appStore.profile.name" icon="user" raw />
			</ItemsContainer>

			<Flex direction="column" gap="12" style="padding: 0 8px;">
				<Text size="13" weight="500" height="150" color="tertiary">
					To access your profile on a new device, the Passkey must be <Text weight="600" color="secondary">synced</Text> with
					it or <Text weight="600" color="secondary">available on another device</Text> you own.
				</Text>
			</Flex>

			<ItemsContainer title="Choose backup mode">
				<SettingItem title="Full Backup" icon="package" iconBgColor="blue" to="/popup/settings/security/export/full" />
			</ItemsContainer>
		</Flex>
		<Flex v-else direction="column" gap="24">
			<Flex direction="column" align="center" gap="16" :class="$style.page_header">
				<Flex :class="$style.page_icon">
					<Icon name="download" size="24" color="primary" />
					<div />
				</Flex>

				<Flex align="center" direction="column" gap="8">
					<Text size="14" weight="600" color="primary">Backup </Text>
					<Text size="13" weight="500" height="150" color="tertiary" align="center" style="padding: 0 24px">
						Get your profile data and credentials so your profile can be restored in the future
					</Text>
				</Flex>
			</Flex>

			<ItemsContainer title="Profile to backup">
				<SettingItem :title="appStore.profile.name" icon="user" raw />
			</ItemsContainer>

			<ItemsContainer title="Choose backup mode">
				<SettingItem title="Full Backup" icon="package" iconBgColor="blue" to="/popup/settings/security/export/full" />
				<SettingItem title="Seed Phrase" icon="text" iconBgColor="blue" to="/popup/settings/security/export/seed" />
				<SettingItem title="Secret Key" icon="key" iconBgColor="blue" to="/popup/settings/security/export/key" />
			</ItemsContainer>
		</Flex>
		

		<ItemsContainer
			description="Explore credentials management capabilities and options for resolving potential issues"
		>
			<SettingItem
				title="Frequently Asked Questions"
				icon="help"
				to="/popup/settings/security/export/faq"
				external
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

.page_icon {
	position: relative;

	& div {
		position: absolute;

		background: linear-gradient(var(--gray-15), var(--gray-5));
		inset: -1px;
		border-radius: 13px;

		z-index: 0;
	}

	& svg {
		z-index: 1;

		border-radius: 12px;
		background: var(--dropdown-bg);
		box-shadow: 0 2px 4px var(--op-10);
		box-sizing: content-box;

		padding: 8px;
	}
}
</style>
