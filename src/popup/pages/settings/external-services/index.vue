<route lang="json">
{
	"meta": {
		"title": "External Services",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import { Dropdown, DropdownItem, DropdownTrigger } from "@/components/ui/Dropdown"

/** Utils */
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { BLOCK_EXPLORERS } from "@/wallet/constants/explorers"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const isLoading = ref(true)

const defaultConfig = new Config()
const stealthMode = ref(defaultConfig.stealthMode)
const contractRegistry = ref(defaultConfig.contractRegistry)
const walletConnectEnabled = ref(defaultConfig.walletConnectEnabled)
const defaultExplorer = ref(defaultConfig.defaultExplorer)

// When stealth mode is ON, all external services are locked/disabled
const isServicesLocked = computed(() => stealthMode.value)

const settings = {
	stealthMode: {
		title: "Stealth Mode",
		description: "Disable all external service connections",
		model: stealthMode,
		visible: ref(true),
	},
	contractRegistry: {
		title: "Contract Registry",
		description: "Lookup contract metadata from external registry",
		model: contractRegistry,
		visible: ref(true),
		locked: isServicesLocked,
	},
	walletConnectEnabled: {
		title: "WalletConnect",
		description: "Connect to dApps via WalletConnect",
		model: walletConnectEnabled,
		visible: ref(true),
		locked: isServicesLocked,
	},
	defaultExplorer: {
		title: "Block Explorer",
		description: "Transaction links",
		model: defaultExplorer,
		visible: ref(true),
		locked: isServicesLocked,
	},
}

// Get display name for selected explorer
const selectedExplorerName = computed(() => {
	if (!defaultExplorer.value) return "None"
	const explorer = BLOCK_EXPLORERS.find(e => e.id === defaultExplorer.value)
	return explorer?.name || "None"
})

async function updateSetting(key, value) {
	if (!settings[key]) return
	if (settings[key].model.value === value) return
	if (settings[key].locked?.value) return

	try {
		await configService.setValue(key, value)
		applySetting(key, value)
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" })
	}
}

async function applySetting(key, value) {
	settings[key].model.value = value

	switch (key) {
		case "stealthMode":
			if (value) {
				// Enabling stealth mode: save snapshot, then disable all
				const snapshot = {
					contractRegistry: contractRegistry.value,
					walletConnectEnabled: walletConnectEnabled.value,
					defaultExplorer: defaultExplorer.value,
				}
				await configService.setValue("stealthModeSnapshot", snapshot)

				await configService.setValue("contractRegistry", false)
				settings.contractRegistry.model.value = false
				await configService.setValue("walletConnectEnabled", false)
				settings.walletConnectEnabled.model.value = false
				await configService.setValue("defaultExplorer", null)
				settings.defaultExplorer.model.value = null
			} else {
				// Disabling stealth mode: restore from snapshot
				const snapshot = await configService.getValue("stealthModeSnapshot")
				if (snapshot) {
					await configService.setValue("contractRegistry", snapshot.contractRegistry)
					settings.contractRegistry.model.value = snapshot.contractRegistry
					await configService.setValue("walletConnectEnabled", snapshot.walletConnectEnabled)
					settings.walletConnectEnabled.model.value = snapshot.walletConnectEnabled
					await configService.setValue("defaultExplorer", snapshot.defaultExplorer)
					settings.defaultExplorer.model.value = snapshot.defaultExplorer
					await configService.setValue("stealthModeSnapshot", null)
				}
			}
			openToast({
				label: value ? "Stealth mode enabled" : "Stealth mode disabled",
				icon: "info"
			}, 1_500)
			break

		case "contractRegistry":
			openToast({ label: "Contract registry updated", icon: "info" }, 1_500)
			break

		case "walletConnectEnabled":
			openToast({ label: "WalletConnect updated", icon: "info" }, 1_500)
			break

		case "defaultExplorer":
			openToast({ label: "Default explorer updated", icon: "info" }, 1_500)
			break
	}
}

function onSettingUpdate(setting) {
	if (settings[setting.key]) {
		if (settings[setting.key].model.value !== setting.value) {
			settings[setting.key].model.value = setting.value
		}
	}
}

onBeforeMount(async () => {
	const _settings = await configService.getProps()
	_settings.forEach(s => {
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
	<Flex direction="column" gap="32" :class="$style.wrapper">
		<Breadcrumbs />

		<Banner v-if="isLoading" isLoading> Fetching settings </Banner>

		<template v-if="!isLoading">
			<!-- Stealth Mode Master Toggle -->
			<Flex align="center" justify="between">
				<Flex direction="column" justify="center" gap="6">
					<Text size="13" weight="600" color="primary">{{ settings.stealthMode.title }}</Text>
					<Text size="12" weight="500" color="tertiary">{{ settings.stealthMode.description }}</Text>
				</Flex>

				<Toggle
					@update:modelValue="updateSetting('stealthMode', $event)"
					:modelValue="settings.stealthMode.model.value"
				/>
			</Flex>

			<Flex :class="$style.divider" />

			<!-- Toggle Settings (contractRegistry, walletConnectEnabled) -->
			<template v-for="sk in ['contractRegistry', 'walletConnectEnabled']" :key="sk">
				<Flex
					v-if="settings[sk].visible.value"
					align="center"
					justify="between"
				>
					<Flex direction="column" justify="center" gap="6">
						<Text size="13" weight="600" color="primary">{{ settings[sk].title }}</Text>
						<Text size="12" weight="500" color="tertiary">{{ settings[sk].description }}</Text>
					</Flex>

					<Toggle
						@update:modelValue="updateSetting(sk, $event)"
						:modelValue="settings[sk].model.value"
						:disabled="settings[sk].locked?.value"
					/>
				</Flex>
			</template>

			<!-- Default Block Explorer (dropdown) -->
			<Flex justify="between" align="center">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">{{ settings.defaultExplorer.title }}</Text>
					<Text size="12" weight="500" color="tertiary">{{ settings.defaultExplorer.description }}</Text>
				</Flex>

				<Dropdown :disabled="settings.defaultExplorer.locked?.value">
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
								<Icon
									:name="!settings.defaultExplorer.model.value ? 'check' : ''"
									size="14"
									color="primary"
								/>
								None
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
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

.divider {
	height: 1px;
	background: var(--gray-8);
	margin: 0 -24px;
	padding: 0 24px;
}

.explorerTrigger {
	min-width: 100px;
	display: flex;
	align-items: center;
	gap: 6px;
}
</style>
