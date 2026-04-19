<script setup>
/** Utils */
import { managers } from "@/utils/core.js"
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const router = useRouter()

const emit = defineEmits(["onClose"])

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.menu?.order
})

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const isDeveloperModeEnabled = ref(new Config().developerMode)

function onSettingUpdate(setting) {
	if (setting.key === "developerMode") {
		isDeveloperModeEnabled.value = setting.value
	}
}

const handleNavigation = (path) => {
	router.push(path)
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
			cacheStore.failureLog = null
			return
		} catch (error) {
			appStore.loggerWindowId = null
		}
	}

	const url = new URL(chrome.runtime.getURL("src/popup/index.html#/windows/logger"))
	if (cacheStore.failureLog?.id) {
		url.searchParams.set("logId", cacheStore.failureLog.id)
	}

	const window = await chrome.windows.create({ type: "popup", url: url.toString(), height: 700, width: 1_200 })
	appStore.loggerWindowId = window.id
	cacheStore.failureLog = null
}

onMounted(async () => {
	isDeveloperModeEnabled.value = await configService.getValue("developerMode")
})

onBeforeUnmount(() => {
	configService.disconnect()
})
</script>

<template>
	<Popup @onClose="emit('onClose')" :displaceIdx="popupStore.popups.menu?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<span :class="$style.menu_title">WALLET</span>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						@click="handleNavigation('/popup/settings/profile')"
						:title="appStore.profile?.name"
						materialIcon="person"
						chevron
					/>
				</ItemsContainer>

				<ItemsContainer>
					<SettingItem
						v-if="isDeveloperModeEnabled"
						@click="handleOpenLogs"
						title="Logs"
						materialIcon="description"
						chevron
					>
						<template v-if="cacheStore.failureLog?.color" #dot>
							<div :class="$style.dot_indicator" :style="{ background: cacheStore.failureLog.color }" />
						</template>
					</SettingItem>
					<SettingItem
						@click="handleNavigation('/popup/settings')"
						title="Settings"
						materialIcon="settings"
						chevron
					/>
				</ItemsContainer>

				<Button
					@click="handleLockWallet"
					type="secondary"
					size="medium"
					leftIcon="lock"
					leftIconColor="secondary"
					data-testid="menu-lock-wallet"
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

.menu_title {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.15em;
	text-transform: uppercase;
	color: var(--txt-primary);
}

.dot_indicator {
	position: absolute;
	top: -2px;
	right: -2px;
	width: 9px;
	height: 9px;
	border-radius: 50%;
}
</style>
