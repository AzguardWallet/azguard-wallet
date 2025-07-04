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
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"

/** Composables */
import { useToast } from "@/composables/toast"
import { useSettings } from "@/composables/settings.js"
const { openToast } = useToast()
const { settings, updateSettings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

let settingService = null
const isLoading = ref(true)
const sessionTtl = ref(DEFAULT_SETTINGS?.session?.ttl)
const isDeveloperModeEnabled = ref(DEFAULT_SETTINGS?.developer?.developerMode) // ref(settings.value?.developer?.advancedMode)
const isIndicationFailuresEnabled = ref(DEFAULT_SETTINGS?.developer?.indicateFailures) // ref(settings.value?.developer?.isIndicationFailuresEnabled)
const isDebugModeEnabled = ref(DEFAULT_SETTINGS?.developer?.debugMode)
const settings1 = {
	ttl: {
		title: "Auto-lock Timeout",
		description: "Time (in minutes) after which the app locks automatically",
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

async function updateSetting(key, value) {
	if (!settings1[key]) return
	if (settings1[key].model.value === value) return

	try {
		await settingService.updateSetting(key, value)
		applySetting(key, value)
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" })
	}
	
}

async function applySetting(key, value) {
	settings1[key].model.value = value

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
	if (settings1[setting.key]) {
		if (settings1[setting.key].model.value !== setting.value) {
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

// watch(
// 	() => isDeveloperModeEnabled.value,
// 	async () => {
// 		updateSettings("developer", "advancedMode", isDeveloperModeEnabled.value)
// 		if (!isIndicationFailuresEnabled.value) {
// 			isIndicationFailuresEnabled.value = true
// 		}
// 	},
// )
// watch(
// 	() => isIndicationFailuresEnabled.value,
// 	async () => {
// 		updateSettings("developer", "isIndicationFailuresEnabled", isIndicationFailuresEnabled.value)
// 	},
// )

onMounted(async () => {
	settingService = new SettingServiceClient(undefined, undefined, onSettingUpdate)
	const _settings = await settingService.getSettings()
	_settings.forEach(s => {
		if (settings1[s.key]) {
			settings1[s.key].model.value = s.value
		}
	})

	isLoading.value = false
})

onBeforeUnmount(() => {
	settingService.dispose()
})
</script>

<template>
	<Flex direction="column" gap="32" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex
			v-for="sk in Object.keys(settings1).filter(sk => sk !== 'ttl')"
			justify="between"
		>
			<template v-if="settings1[sk].visible.value">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> {{ settings1[sk].title }} </Text>
					<Text size="12" weight="500" color="tertiary"> {{ settings1[sk].description }} </Text>
				</Flex>

				<Toggle
					@update:modelValue="updateSetting(sk, $event)"
					:modelValue="settings1[sk].model.value"
				/>
			</template>
		</Flex>


		<!-- <Flex justify="between">
			<Flex direction="column" gap="6">
				<Text size="13" weight="600" color="primary"> Developer Mode </Text>
				<Text size="12" weight="500" color="tertiary"> Access to entity metadata, etc </Text>
			</Flex>

			<Toggle v-model="isDeveloperModeEnabled" />
		</Flex>

		<Flex
			v-if="isDeveloperModeEnabled"
			direction="column"
			gap="24"
		>
			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Indicate failures </Text>
					<Text size="12" weight="500" color="tertiary"> Highlight errors and warnings in header </Text>
				</Flex>

				<Toggle v-model="isIndicationFailuresEnabled" />
			</Flex> -->

			<!-- <Flex direction="column" gap="12">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Full storage reset </Text>
					<Text size="12" weight="500" height="140" color="tertiary"> All local data will be deleted </Text>
				</Flex>

				<Button @click="handleFullReset" type="red" size="small" disabled> Full Reset </Button>
			</Flex> -->
		<!-- </Flex> -->

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

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
