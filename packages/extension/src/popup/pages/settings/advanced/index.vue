<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"

/** Utils */
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { BLOCK_EXPLORERS } from "@/wallet/constants/explorers"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

/** Developer-only: open the logs window (previously accessible via the
 *  hamburger MenuPopup, now relocated here as part of the menu removal). */
const handleOpenLogs = async () => {
	if (appStore.loggerWindowId) {
		try {
			const win = await chrome.windows.get(appStore.loggerWindowId)
			chrome.windows.update(win.id, { focused: true })
			cacheStore.failureLog = null
			return
		} catch (_err) {
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

const isLoading = ref(true)

const defaultConfig = new Config()
const isDeveloperModeEnabled = ref(defaultConfig.developerMode)
const isIndicationFailuresEnabled = ref(defaultConfig.indicateFailures)
const isDebugModeEnabled = ref(defaultConfig.debugMode)
const defaultExplorer = ref(defaultConfig.defaultExplorer)

const settings = {
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
	defaultExplorer: {
		title: "Block Explorer",
		description: "Transaction link explorer",
		model: defaultExplorer,
		visible: ref(true),
	},
}

// Get display name for selected explorer
const selectedExplorerName = computed(() => {
	if (!defaultExplorer.value) return "None"
	const explorer = BLOCK_EXPLORERS.find((e) => e.id === defaultExplorer.value)
	return explorer?.name || "None"
})

async function updateSetting(key, value) {
	if (!settings[key]) return
	if (settings[key].model.value === value) return

	try {
		await configService.setValue(key, value)
		applySetting(key, value)
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" }, TOAST_DURATION.LONG)
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
			break

		case "defaultExplorer":
			openToast({ label: "Default explorer updated", icon: "info" }, TOAST_DURATION.SHORT)
			break

		default:
			break
	}
}

function onSettingUpdate(setting) {
	if (settings[setting.key]) {
		if (settings[setting.key].model.value !== setting.value) {
			applySetting(setting.key, setting.value)
		}
	}
}

onBeforeMount(async () => {
	const _settings = await configService.getProps()
	_settings.forEach((s) => {
		if (settings[s.key]) {
			settings[s.key].model.value = s.value
		}
	})

	isLoading.value = false
})

onBeforeUnmount(() => {
	configService.disconnect()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Advanced Settings" :backTo="'/popup/settings'" />

		<Flex direction="column" gap="32" :class="$style.content">
			<LoadingState v-if="isLoading" label="FETCHING SETTINGS" />

			<template v-if="!isLoading">
				<template v-for="sk in Object.keys(settings).filter((sk) => sk !== 'defaultExplorer')" :key="sk">
					<Flex v-if="settings[sk].visible.value" align="center" justify="between">
						<Flex direction="column" justify="center" gap="6">
							<Text size="13" weight="600" color="primary">{{ settings[sk].title }}</Text>
							<Text size="12" weight="500" color="tertiary">{{ settings[sk].description }}</Text>
						</Flex>

						<Toggle @update:modelValue="updateSetting(sk, $event)" :modelValue="settings[sk].model.value" />
					</Flex>
				</template>

				<!-- Logs (developer mode only) -->
				<div
					v-if="isDeveloperModeEnabled"
					@click="handleOpenLogs"
					:class="$style.logs_link"
					role="button"
					tabindex="0"
					@keydown.enter="handleOpenLogs"
				>
					<Flex justify="between" align="center">
						<Flex direction="column" gap="6">
							<Flex align="center" gap="8">
								<Text size="13" weight="600" color="primary">Logs</Text>
								<div
									v-if="cacheStore.failureLog?.color"
									:class="$style.failure_dot"
									:style="{ background: cacheStore.failureLog.color }"
								/>
							</Flex>
							<Text size="12" weight="500" color="tertiary">
								{{ cacheStore.failureLog ? '1 recent failure' : 'Open the log viewer window' }}
							</Text>
						</Flex>
						<MaterialIcon name="open_in_new" :size="18" color="secondary" />
					</Flex>
				</div>

				<!-- Account State (Notes, Authwits, Contracts, Senders) -->
				<RouterLink to="/popup/settings/advanced/account-state" :class="$style.state_link">
					<Flex justify="between" align="center">
						<Flex direction="column" gap="6">
							<Text size="13" weight="600" color="primary">Account State</Text>
							<Text size="12" weight="500" color="tertiary">Notes, authwits, contracts, senders</Text>
						</Flex>
						<MaterialIcon name="chevron_right" :size="18" color="secondary" />
					</Flex>
				</RouterLink>

				<!-- Default Block Explorer -->
				<Flex justify="between" align="center">
					<Flex direction="column" gap="6">
						<Text size="13" weight="600" color="primary">{{ settings.defaultExplorer.title }}</Text>
						<Text size="12" weight="500" color="tertiary">{{ settings.defaultExplorer.description }}</Text>
					</Flex>

					<Dropdown>
						<template #trigger>
							<DropdownTrigger :class="$style.explorerTrigger">
								<Text size="13" weight="600" color="primary">
									{{ selectedExplorerName }}
								</Text>
								<Icon name="chevron-down" size="12" color="tertiary" />
							</DropdownTrigger>
						</template>

						<template #popup>
							<DropdownItem
								v-for="explorer in BLOCK_EXPLORERS"
								:key="explorer.id"
								@click="updateSetting('defaultExplorer', explorer.id)"
							>
								<Flex align="center" gap="8">
									<Icon
										:name="settings.defaultExplorer.model.value === explorer.id ? 'check' : ''"
										size="14"
										color="primary"
									/>
									{{ explorer.name }}
								</Flex>
							</DropdownItem>
							<DropdownItem @click="updateSetting('defaultExplorer', null)">
								<Flex align="center" gap="8">
									<Icon :name="!settings.defaultExplorer.model.value ? 'check' : ''" size="14" color="primary" />
									None
								</Flex>
							</DropdownItem>
						</template>
					</Dropdown>
				</Flex>
			</template>
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

.explorerTrigger {
	display: flex;
	align-items: center;
	gap: 6px;
}

.state_link {
	text-decoration: none;
	transition: opacity 0.2s var(--bezier);

	&:hover {
		opacity: 0.8;
	}
}

.logs_link {
	cursor: pointer;
	outline: none;

	transition: opacity 0.2s var(--bezier);

	&:hover {
		opacity: 0.8;
	}
}

.failure_dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}
</style>
