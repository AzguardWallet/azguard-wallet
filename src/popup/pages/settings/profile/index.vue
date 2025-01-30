<route lang="json">
{
	"meta": {
		"title": "Profile Settings",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
import SettingField from "@/components/ui/Settings/SettingField.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const version = __VERSION__

const handleCopyVersion = () => {
	window.navigator.clipboard.writeText(version)
	openToast({ label: "Version is copied", icon: "copy" })
}

const handleOpen = target => {
	chrome.windows.create({
		type: "popup",
		url: `https://azguardwallet.io/${target}`,
		width: 360,
		height: 600,
	})
}
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<Flex direction="column" gap="24" align="center">
			<Breadcrumbs />

			<PageHeader :title="appStore.profile.name" :description="appStore.profile.id" icon="user" />

			<ItemsContainer wide>
				<SettingField label="Name" :value="appStore.profile.name" icon="edit" />
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem to="/popup/settings/security/export" title="Backup profile" icon="key-square" chevron />
				<SettingItem title="Change password" icon="profile-password" disabled />
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem
					@click="popupStore.open('reset')"
					title="Delete profile"
					icon="trash"
					iconBgColor="var(--red)"
				/>
			</ItemsContainer>
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
</style>
