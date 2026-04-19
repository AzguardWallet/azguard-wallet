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

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Stores */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const isLoading = ref(true)

const defaultConfig = new Config()
const stealthMode = ref(defaultConfig.stealthMode)
const contractRegistry = ref(defaultConfig.contractRegistry)
const uploadExternalImages = ref(defaultConfig.uploadExternalImages)
const externalLinks = ref(defaultConfig.externalLinks)

// Track if exit dialog has been shown (suppress subsequent dialogs)
const dialogsSuppressed = ref(false)

const settings = {
	stealthMode: {
		title: "Stealth Mode",
		description: "Disable all external service connections",
		model: stealthMode,
		visible: ref(true),
	},
	contractRegistry: {
		title: "Contract Registry",
		description: "Fetch contract info externally",
		model: contractRegistry,
		visible: ref(true),
	},
	uploadExternalImages: {
		title: "Upload external images",
		description: "Load images from external URLs",
		model: uploadExternalImages,
		visible: ref(true),
	},
	externalLinks: {
		title: "External links",
		description: "Control external link behavior",
		model: externalLinks,
		visible: ref(true),
	},
}

// Check if all privacy settings are disabled (for auto-enable stealth)
const isAllDisabled = computed(() => {
	return !contractRegistry.value && !uploadExternalImages.value && externalLinks.value === "disabled"
})

// Show exit stealth mode dialog
function showExitStealthDialog(onConfirm) {
	cacheStore.confirm.title = "Exit Stealth Mode?"
	cacheStore.confirm.description = "External service connections will be allowed"
	cacheStore.confirm.confirm_text = "Yes, exit"
	cacheStore.confirm.confirm_color = "primary"
	cacheStore.confirm.callback = onConfirm
	popupStore.open("confirm")
}

// Enable stealth mode: turn off all settings
async function enableStealthMode() {
	dialogsSuppressed.value = false // Reset dialog suppression

	await configService.setValue("stealthMode", true)
	stealthMode.value = true

	await configService.setValue("contractRegistry", false)
	contractRegistry.value = false
	await configService.setValue("uploadExternalImages", false)
	uploadExternalImages.value = false
	await configService.setValue("externalLinks", "disabled")
	externalLinks.value = "disabled"

	openToast({ label: "Stealth mode enabled", icon: "info" }, TOAST_DURATION.SHORT)
}

// Disable stealth mode: turn on all settings
async function disableStealthMode() {
	dialogsSuppressed.value = true // Suppress subsequent dialogs

	await configService.setValue("stealthMode", false)
	stealthMode.value = false

	await configService.setValue("contractRegistry", true)
	contractRegistry.value = true
	await configService.setValue("uploadExternalImages", true)
	uploadExternalImages.value = true
	await configService.setValue("externalLinks", "enabled")
	externalLinks.value = "enabled"

	openToast({ label: "Stealth mode disabled", icon: "info" }, TOAST_DURATION.SHORT)
}

// Exit stealth mode and apply a specific setting change
async function exitStealthAndApply(key, value) {
	await configService.setValue("stealthMode", false)
	stealthMode.value = false

	await configService.setValue(key, value)
	settings[key].model.value = value

	openToast({ label: "Stealth mode disabled", icon: "info" }, TOAST_DURATION.SHORT)
}

async function updateSetting(key, value) {
	if (!settings[key]) return
	if (settings[key].model.value === value) return

	try {
		if (key === "stealthMode") {
			if (value) {
				// 3.1, 3.5: Enable stealth - no dialog
				await enableStealthMode()
			} else {
				// 3.2: Disable stealth - show dialog
				showExitStealthDialog(async () => {
					await disableStealthMode()
				})
			}
			return
		}

		// For non-stealth settings
		if (stealthMode.value) {
			// 3.3: Changing a setting while stealth is ON
			if (dialogsSuppressed.value) {
				// Dialog already shown, just exit stealth and apply
				await exitStealthAndApply(key, value)
			} else {
				// Show exit dialog first
				showExitStealthDialog(async () => {
					dialogsSuppressed.value = true
					await exitStealthAndApply(key, value)
				})
			}
			return
		}

		// Normal update (stealth is OFF)
		await configService.setValue(key, value)
		settings[key].model.value = value

		// 3.4: Auto-enable stealth when last element turned off
		if (isAllDisabled.value && !stealthMode.value) {
			await configService.setValue("stealthMode", true)
			stealthMode.value = true
			dialogsSuppressed.value = false
			openToast({ label: "Stealth mode auto-enabled", icon: "info" }, TOAST_DURATION.SHORT)
		}
	} catch (err) {
		openToast({ label: "Failed to update setting", icon: "warning" }, TOAST_DURATION.LONG)
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
		<SubPageHeader title="Privacy Settings" :backTo="'/popup/settings'" />

		<Flex direction="column" gap="32" :class="$style.content">
			<Banner v-if="isLoading" isLoading> Fetching settings </Banner>

		<template v-if="!isLoading">
			<!-- Stealth Mode Master Toggle -->
			<Flex align="center" justify="between" data-testid="setting-stealth-mode">
				<Flex direction="column" justify="center" gap="4">
					<span :class="$style.setting_key">{{ settings.stealthMode.title }}</span>
					<span :class="$style.setting_sub">{{ settings.stealthMode.description }}</span>
				</Flex>

				<Toggle
					@update:modelValue="updateSetting('stealthMode', $event)"
					:modelValue="settings.stealthMode.model.value"
				/>
			</Flex>

			<Flex :class="$style.divider" />

			<!-- Toggle Settings (contractRegistry, uploadExternalImages) -->
			<template v-for="sk in ['contractRegistry', 'uploadExternalImages']" :key="sk">
				<Flex
					v-if="settings[sk].visible.value"
					align="center"
					justify="between"
				>
					<Flex direction="column" justify="center" gap="4">
						<span :class="$style.setting_key">{{ settings[sk].title }}</span>
						<span :class="$style.setting_sub">{{ settings[sk].description }}</span>
					</Flex>

					<Toggle
						@update:modelValue="updateSetting(sk, $event)"
						:modelValue="settings[sk].model.value"
					/>
				</Flex>
			</template>

			<!-- External Links (dropdown) -->
			<Flex justify="between" align="center">
				<Flex direction="column" gap="4">
					<span :class="$style.setting_key">{{ settings.externalLinks.title }}</span>
					<span :class="$style.setting_sub">{{ settings.externalLinks.description }}</span>
				</Flex>

				<Dropdown>
					<template #trigger>
						<DropdownTrigger :class="$style.dropdownTrigger">
							<Text size="13" weight="600" color="primary" style="text-transform: capitalize">
								{{ externalLinks === 'confirm' ? 'Confirm' : externalLinks }}
							</Text>
							<Icon name="chevron-down" size="12" color="tertiary" />
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem @click="updateSetting('externalLinks', 'disabled')">
							<Flex align="center" gap="8">
								<Icon :name="externalLinks === 'disabled' ? 'check' : ''" size="14" color="primary" />
								Disabled
							</Flex>
						</DropdownItem>
						<DropdownItem @click="updateSetting('externalLinks', 'confirm')">
							<Flex align="center" gap="8">
								<Icon :name="externalLinks === 'confirm' ? 'check' : ''" size="14" color="primary" />
								Ask for confirmation
							</Flex>
						</DropdownItem>
						<DropdownItem @click="updateSetting('externalLinks', 'enabled')">
							<Flex align="center" gap="8">
								<Icon :name="externalLinks === 'enabled' ? 'check' : ''" size="14" color="primary" />
								Enabled
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

.setting_key {
	font-family: var(--font-headline);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.setting_sub {
	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-outline);
}

.divider {
	height: 1px;
	background: var(--nulo-surface-high);
	margin: 0 -24px;
	padding: 0 24px;
}

.dropdownTrigger {
	min-width: 100px;
	display: flex;
	align-items: center;
	gap: 6px;
}
</style>
