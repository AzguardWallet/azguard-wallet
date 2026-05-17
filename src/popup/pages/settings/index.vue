<route lang="json">
{
	"meta": {
		"title": "Settings",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" wide :class="$style.wrapper">
		<TestnetAlert />

		<Flex direction="column" gap="20" :class="$style.wrapper_inner">
			<Breadcrumbs hide-navigation />

			<Flex direction="column" gap="24">
				<ItemsContainer title="Wallet">
					<SettingItem
						to="/popup/settings/profile"
						:title="appStore.profile.name"
						icon="user"
						iconBgColor="blue"
						chevron
					/>
					<SettingItem
						to="/popup/settings/account"
						:title="appStore.account.name"
						icon="vault"
						iconBgColor="blue"
						chevron
					/>
				</ItemsContainer>

				<ItemsContainer>
					<SettingItem to="/popup/settings/general" title="General" icon="settings" iconBgColor="green" chevron />
					<SettingItem
						to="/popup/settings/security"
						title="Security"
						icon="key-circle"
						iconBgColor="red"
						chevron
					/>
					<SettingItem
						to="/popup/settings/advanced"
						title="Advanced"
						icon="zap"
						iconBgColor="sand"
						chevron
					/>
				</ItemsContainer>

				<ItemsContainer>
					<SettingItem to="/popup/settings/about" size="small" title="About Azguard Wallet" chevron />
				</ItemsContainer>
			</Flex>

			<Navigation />
		</Flex>
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
}

.wrapper_inner {
	flex: 1;

	padding: 20px 24px 80px 24px;
}
</style>
