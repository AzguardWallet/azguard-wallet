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
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { ProfileServiceClient } from "@/wallet/services/profile/client"
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

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const profileService = new ProfileServiceClient()
const isLoading = ref(true)

const defaultConfig = new Config()
const MAX_SESSION_TTL = 1440
const sessionTtl = ref(defaultConfig.sessionTtl)
const sessionTtlMinutes = ref(0)
const isDeveloperModeEnabled = ref(defaultConfig.developerMode)
const isIndicationFailuresEnabled = ref(defaultConfig.indicateFailures)
const isDebugModeEnabled = ref(defaultConfig.debugMode)

const settings = {
	sessionTtl: {
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
		await configService.setValue(key, value)
		applySetting(key, value)

		if (key === "sessionTtl") {
			await profileService.refreshSession()
			openToast({ label: "Auto-lock timeout updated", icon: "info" }, 1_500)
		}
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
		updateSetting("sessionTtl", sessionTtlMinutes.value * 60 * 1_000)
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
	const _settings = await configService.getProps()
	_settings.forEach(s => {
		if (settings[s.key]) {
			settings[s.key].model.value = s.value
		}
	})

	sessionTtlMinutes.value = String(sessionTtl.value / 1_000 / 60)

	isLoading.value = false
})

onBeforeUnmount(() => {
	configService.disconnect()
	profileService.disconnect()
})
</script>

<template>
	<Flex direction="column" gap="32" :class="$style.wrapper">
		<Breadcrumbs />

		<Banner v-if="isLoading" isLoading> Fetching settings </Banner>

		<template v-if="!isLoading">
			<Flex justify="between" align="center">
				<Flex direction="column" gap="6">
					<Flex align="end" gap="6">
						<Text size="13" weight="600" color="primary"> {{ settings.sessionTtl.title }} </Text>
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
					<Text size="12" weight="500" color="tertiary"> {{ settings.sessionTtl.description }} </Text>
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
			<template v-for="sk in Object.keys(settings).filter(sk => sk !== 'sessionTtl')" :key="sk">
				<Flex
					v-if="settings[sk].visible.value"
					align="center"
					justify="between"
				>
					<Flex direction="column" justify="center" gap="6">
						<Text size="13" weight="600" color="primary"> {{ settings[sk].title }} </Text>
						<Text size="12" weight="500" color="tertiary"> {{ settings[sk].description }} </Text>
					</Flex>

					<Toggle
						@update:modelValue="updateSetting(sk, $event)"
						:modelValue="settings[sk].model.value"
					/>
				</Flex>
			</template>

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
