<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { managers } from "@/utils/core.js"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

const emit = defineEmits(["onClose"])

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.menu
})

const handleNavigation = () => {
	router.push("/popup/settings")
	emit("onClose")
}

const handleLockWallet = () => {
	emit("onClose")
	appStore.isLogined = false
	managers.profile.lockActiveProfile()
}
</script>

<template>
	<Popup @onClose="emit('onClose')" :displaceIdx="popupStore.popups.menu">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Profile</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						@click="emit('onClose')"
						to="/popup/settings/profile"
						:title="appStore.profile.name"
						icon="user"
						iconBgColor="blue"
						chevron
					/>
					<SettingItem
						@click="popupStore.open('select_profile')"
						size="small"
						title="Switch profile"
						icon="switch"
						iconBgColor="transparent"
						:disabled="appStore.profiles.length === 1"
					/>
				</ItemsContainer>

				<ItemsContainer title="Other">
					<SettingItem title="Contacts" icon="contacts" iconBgColor="var(--green)" chevron disabled />
					<SettingItem
						@click="handleNavigation('/popup/settings')"
						title="Settings"
						icon="settings"
						chevron
					/>
				</ItemsContainer>

				<Button
					@click="handleLockWallet"
					type="secondary"
					size="medium"
					leftIcon="lock"
					leftIconColor="secondary"
				>
					Lock Wallet
				</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
