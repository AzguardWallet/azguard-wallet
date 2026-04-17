<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

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

const handleOpen = (target) => {
	chrome.windows.create({
		type: "popup",
		url: `https://nulo.sh/${target}`,
		width: 360,
		height: 600,
	})
}
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Profile Settings" :backTo="'/popup/settings'" />

		<Flex direction="column" gap="24" align="center" :class="$style.content">
			<PageHeader v-if="appStore.profile" :title="appStore.profile?.name" :description="appStore.profile?.id" icon="user" />

			<ItemsContainer wide>
				<SettingField
					v-if="appStore.profile"
					@click="popupStore.open('edit_profile')"
					label="Name" :value="appStore.profile?.name" icon="edit" />
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem to="/popup/settings/security/export" title="Backup profile" icon="key-square" chevron />
				<SettingItem @click="popupStore.open('change_profile_password')" title="Change password" icon="profile-password" :disabled="appStore.profile.type === 'passkey'" />
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem @click="popupStore.open('reset')" title="Delete profile" icon="trash" iconBgColor="red" />
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
