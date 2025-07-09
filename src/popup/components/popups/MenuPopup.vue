<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { managers } from "@/utils/core.js"
import { SettingServiceClient } from "@/wallet/services/settings/client"
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

const emit = defineEmits(["onClose"])

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.menu?.order
})

let settingService = null
const isDeveloperModeEnabled = ref(DEFAULT_SETTINGS?.developer?.developerMode)

function onSettingUpdate(setting) {
	if (setting.key === "developerMode") {
		isDeveloperModeEnabled.value = setting.value
	}
}

const handleNavigation = () => {
	router.push("/popup/settings")
	emit("onClose")
}

const handleLockWallet = () => {
	emit("onClose")
	appStore.isLogined = false
	managers.profile.lockActiveProfile()
}

const handleOpenLogs = async () => {
	if (appStore.loggerWindowId) {
		try {
			const win = await chrome.windows.get(appStore.loggerWindowId)
			chrome.windows.update(win.id, { focused: true })
			return
		} catch (error) {
			appStore.loggerWindowId = null
		}
	}

	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/logger"))
	const window = await chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 1_200 })
	appStore.loggerWindowId = window.id
}

onMounted(async () => {
	settingService = new SettingServiceClient(undefined, undefined, onSettingUpdate)
	isDeveloperModeEnabled.value = (await settingService.getSetting("developerMode"))?.value
})

onBeforeUnmount(() => {
	settingService.dispose()
})
</script>

<template>
	<Popup @onClose="emit('onClose')" :displaceIdx="popupStore.popups.menu?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Wallet</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer title="Profile">
					<SettingItem
						@click="emit('onClose')"
						to="/popup/settings/profile"
						:title="appStore.profile.name"
						icon="user"
						iconBgColor="blue"
						chevron
					/>
					<!-- <SettingItem
						@click="popupStore.open('select_profile')"
						size="small"
						title="Switch profile"
						icon="switch"
						iconBgColor="transparent"
						:disabled="appStore.profiles.length === 1"
					/> -->
					<SettingItem title="Contacts" icon="contacts" iconBgColor="var(--green)" chevron disabled />
				</ItemsContainer>

				<ItemsContainer title="Other">
					<SettingItem title="Task tracker" icon="task-tracker" iconBgColor="var(--green)" chevron disabled />
					<SettingItem
						v-if="isDeveloperModeEnabled"
						@click="handleOpenLogs"
						title="Logs"
						icon="logs"
						iconBgColor="var(--gray)"
						chevron
					/>
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
