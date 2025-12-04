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

// Get display name for selected explorer
const selectedExplorerName = computed(() => {
	if (isServicesLocked.value) return "Disabled"
	const explorer = BLOCK_EXPLORERS.find(e => e.id === defaultExplorer.value)
	return explorer?.name || "None"
})

function onSettingUpdate(setting) {
	if (setting.key === "stealthMode" && stealthMode.value !== setting.value) {
		stealthMode.value = setting.value
	}
	if (setting.key === "contractRegistry" && contractRegistry.value !== setting.value) {
		contractRegistry.value = setting.value
	}
	if (setting.key === "walletConnectEnabled" && walletConnectEnabled.value !== setting.value) {
		walletConnectEnabled.value = setting.value
	}
	if (setting.key === "defaultExplorer" && defaultExplorer.value !== setting.value) {
		defaultExplorer.value = setting.value
	}
}

async function handleStealthModeChange(value) {
	if (stealthMode.value === value) return
	try {
		if (value) {
			// Enabling stealth mode: save snapshot, then disable all
			const snapshot = {
				contractRegistry: contractRegistry.value,
				walletConnectEnabled: walletConnectEnabled.value,
				defaultExplorer: defaultExplorer.value,
			}
			await configService.setValue("stealthModeSnapshot", snapshot)

			await configService.setValue("contractRegistry", false)
			contractRegistry.value = false
			await configService.setValue("walletConnectEnabled", false)
			walletConnectEnabled.value = false
			await configService.setValue("defaultExplorer", "none")
			defaultExplorer.value = "none"
		} else {
			// Disabling stealth mode: restore from snapshot
			const snapshot = await configService.getValue("stealthModeSnapshot")
			if (snapshot) {
				await configService.setValue("contractRegistry", snapshot.contractRegistry)
				contractRegistry.value = snapshot.contractRegistry
				await configService.setValue("walletConnectEnabled", snapshot.walletConnectEnabled)
				walletConnectEnabled.value = snapshot.walletConnectEnabled
				await configService.setValue("defaultExplorer", snapshot.defaultExplorer)
				defaultExplorer.value = snapshot.defaultExplorer
				await configService.setValue("stealthModeSnapshot", null)
			}
		}

		await configService.setValue("stealthMode", value)
		stealthMode.value = value

		openToast({
			label: value ? "Stealth mode enabled" : "Stealth mode disabled",
			icon: "info"
		}, 1_500)
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" })
	}
}

async function handleContractRegistryChange(value) {
	if (isServicesLocked.value || contractRegistry.value === value) return
	try {
		await configService.setValue("contractRegistry", value)
		contractRegistry.value = value
		openToast({ label: "Contract registry updated", icon: "info" }, 1_500)
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" })
	}
}

async function handleWalletConnectChange(value) {
	if (isServicesLocked.value || walletConnectEnabled.value === value) return
	try {
		await configService.setValue("walletConnectEnabled", value)
		walletConnectEnabled.value = value
		openToast({ label: "WalletConnect updated", icon: "info" }, 1_500)
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" })
	}
}

async function handleExplorerChange(explorerId) {
	if (isServicesLocked.value || defaultExplorer.value === explorerId) return
	try {
		await configService.setValue("defaultExplorer", explorerId)
		defaultExplorer.value = explorerId
		openToast({ label: "Default explorer updated", icon: "info" }, 1_500)
	} catch (err) {
		openToast({ label: "Failed to update explorer", icon: "warning" })
	}
}

onBeforeMount(async () => {
	const _settings = await configService.getProps()
	_settings.forEach(s => {
		if (s.key === "stealthMode") {
			stealthMode.value = s.value
		}
		if (s.key === "contractRegistry") {
			contractRegistry.value = s.value
		}
		if (s.key === "walletConnectEnabled") {
			walletConnectEnabled.value = s.value
		}
		if (s.key === "defaultExplorer") {
			defaultExplorer.value = s.value
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
					<Text size="13" weight="600" color="primary">Stealth Mode</Text>
					<Text size="12" weight="500" color="tertiary">Disable all external service connections</Text>
				</Flex>

				<Toggle
					@update:modelValue="handleStealthModeChange"
					:modelValue="stealthMode"
				/>
			</Flex>

			<Flex :class="$style.divider" />

			<!-- Contract Registry -->
			<Flex align="center" justify="between">
				<Flex direction="column" justify="center" gap="6">
					<Text size="13" weight="600" color="primary">Contract Registry</Text>
					<Text size="12" weight="500" color="tertiary">Lookup contract metadata from external registry</Text>
				</Flex>

				<Toggle
					@update:modelValue="handleContractRegistryChange"
					:modelValue="contractRegistry"
					:disabled="isServicesLocked"
				/>
			</Flex>

			<!-- WalletConnect -->
			<Flex align="center" justify="between">
				<Flex direction="column" justify="center" gap="6">
					<Text size="13" weight="600" color="primary">WalletConnect</Text>
					<Text size="12" weight="500" color="tertiary">Connect to dApps via WalletConnect</Text>
				</Flex>

				<Toggle
					@update:modelValue="handleWalletConnectChange"
					:modelValue="walletConnectEnabled"
					:disabled="isServicesLocked"
				/>
			</Flex>

			<!-- Default Block Explorer -->
			<Flex justify="between" align="center">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">Block Explorer</Text>
					<Text size="12" weight="500" color="tertiary">Explorer for transaction links</Text>
				</Flex>

				<!-- Locked state: just show disabled trigger -->
				<Flex
					v-if="isServicesLocked"
					:class="[$style.explorerTrigger, $style.disabled]"
				>
					<Text size="13" weight="600" color="tertiary">Disabled</Text>
					<Icon name="lock" size="12" color="tertiary" />
				</Flex>

				<!-- Unlocked state: show dropdown -->
				<Dropdown v-else>
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
							@click="handleExplorerChange(explorer.id)"
						>
							<Flex align="center" gap="8">
								<Icon
									:name="defaultExplorer === explorer.id ? 'check' : ''"
									size="14"
									color="primary"
								/>
								{{ explorer.name }}
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

.disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
</style>
