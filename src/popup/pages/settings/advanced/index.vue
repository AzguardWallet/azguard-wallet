<route lang="json">
{
	"meta": {
		"title": "Advanced Settings",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"

/** Utils */
import { managers } from "@/utils/core"
import { SettingServiceClient } from "@/wallet/services/settings/client"
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"
import { debounce } from "@/utils/general"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

let settingService = null
let profileService = null
const isLoading = ref(true)

const MAX_SESSION_TTL = 1440
const sessionTtl = ref(DEFAULT_SETTINGS?.session?.ttl)
const sessionTtlMinutes = ref(0)
const isDeveloperModeEnabled = ref(DEFAULT_SETTINGS?.developer?.developerMode)
const isIndicationFailuresEnabled = ref(DEFAULT_SETTINGS?.developer?.indicateFailures)
const isDebugModeEnabled = ref(DEFAULT_SETTINGS?.developer?.debugMode)

const settings = {
	ttl: {
		title: "Auto-lock Timeout",
		description: "Automatic wallet locking (minutes)",
		model: sessionTtl,
		visible: ref(true),
	},
	developerMode: {
		title: "Developer Mode",
		description: "Access to entity metadata, etc",
		model: isDeveloperModeEnabled,
		visible: ref(true),
	},
	indicateFailures: {
		title: "Indicate Failures",
		description: "Highlight errors and warnings in the header",
		model: isIndicationFailuresEnabled,
		visible: isDeveloperModeEnabled,
	},
	debugMode: {
		title: "Debug Mode",
		description: "Collect debug level logs",
		model: isDebugModeEnabled,
		visible: isDeveloperModeEnabled,
	},
}

const notification = reactive({
	show: false,
	text: "",
})
function fillNotification(text) {
	if (!text) {
		notification.show = false
		notification.text = ""
		return
	}

	notification.show = true
	notification.text = text
}

async function updateSetting(key, value) {
	if (!settings[key]) return
	if (settings[key].model.value === value) return

	try {
		await settingService.updateSetting(key, value)
		applySetting(key, value)
		await profileService.refreshSession()
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" })
	}
}

async function applySetting(key, value) {
	settings[key].model.value = value

	switch (key) {
		case "developerMode":
			updateSetting("indicateFailures", value)
			if (!value) {
				updateSetting("debugMode", value)
			}
			
			break;
	
		default:
			break;
	}
}

function onSettingUpdate(setting) {
	if (settings[setting.key]) {
		if (settings[setting.key].model.value !== setting.value) {
			applySetting(setting.key, setting.value)
		}
	}
}

const handleFullReset = () => {
	cacheStore.confirm.description = "You want to completely delete all local data - settings and so on"
	cacheStore.confirm.callback = async () => {
		try {
			await managers.profile.deleteProfile(appStore.profile.id)
		} catch (error) {
			// TODO: handle errors
		}
		await chrome.storage.local.clear()
		await chrome.storage.session.clear()
		chrome.runtime.reload()
	}

	popupStore.open("confirm")
}

watch(
	() => sessionTtlMinutes.value,
	debounce(() => {
		updateSetting("ttl", sessionTtlMinutes.value * 60 * 1_000)
		switch (sessionTtlMinutes.value) {
			case 0:
				fillNotification("'0' means the wallet will never be locked automatically")
				break;
			case MAX_SESSION_TTL:
				fillNotification("This is the maximum session time. Use 0 to disable auto-lock.")
				break;
			
			default:
				fillNotification("")
				break;
		}
	}, 300)
)

onBeforeMount(async () => {
	profileService = new ProfileServiceClient()
	settingService = new SettingServiceClient(undefined, undefined, onSettingUpdate)
	const _settings = await settingService.getSettings()
	_settings.forEach(s => {
		if (settings[s.key]) {
			settings[s.key].model.value = s.value
		}
	})

	sessionTtlMinutes.value = sessionTtl.value / 1_000 / 60

	isLoading.value = false
})

onBeforeUnmount(() => {
	settingService.dispose()
	profileService.dispose()
})
</script>

<template>
	<Flex direction="column" gap="32" :class="$style.wrapper">
		<Breadcrumbs />

		<Banner v-if="isLoading" isLoading> Fetching settings </Banner>

		<template v-if="!isLoading">
			<Flex justify="between" align="center">
				<Flex direction="column" gap="6">
					<Flex align="center" gap="6">
						<Text size="13" weight="600" color="primary"> {{ settings.ttl.title }} </Text>
						<Tooltip
							v-if="notification.show"
						>
							<Icon name="info" color="secondary" size="14" />

							<template #content>
								<Flex align="center" :class="$style.tooltip">
									<Text size="12" color="secondary"> {{ notification.text }} </Text>
								</Flex>
							</template>
						</Tooltip>
					</Flex>				
					<Text size="12" weight="500" color="tertiary"> {{ settings.ttl.description }} </Text>
				</Flex>

				<Input
					v-model="sessionTtlMinutes"
					type="text"
					subtype="int"
					:max="MAX_SESSION_TTL"
					placeholder="30"
					:class="$style.input"
				/>
			</Flex>
			<Flex
				v-for="sk in Object.keys(settings).filter(sk => sk !== 'ttl')"
				align="center"
				justify="between"
			>
				<template v-if="settings[sk].visible.value">
					<Flex direction="column" justify="center" gap="6">
						<Text size="13" weight="600" color="primary"> {{ settings[sk].title }} </Text>
						<Text size="12" weight="500" color="tertiary"> {{ settings[sk].description }} </Text>
					</Flex>

					<Toggle
						@update:modelValue="updateSetting(sk, $event)"
						:modelValue="settings[sk].model.value"
					/>
				</template>
			</Flex>
		</template>

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

.tooltip {
	max-width: 200px;

	* {
		line-height: 1.2;
	}
}
.input {
	width: 60px;
	* {
		text-align: center;
	}
}
</style>
