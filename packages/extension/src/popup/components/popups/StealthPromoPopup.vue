<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"

/** Utils */
import { ConfigServiceClient } from "@/wallet/services/config/client"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const configService = new ConfigServiceClient()

const emit = defineEmits(["onClose", "onCreateProfile"])
const props = defineProps({
	show: Boolean,
})

// When shown directly (not via popupStore), use a default high displaceIdx
const displaceIdx = computed(() => {
	const order = popupStore.popups.stealth_promo?.order
	if (order !== undefined) {
		return popupStore.len - order
	}
	// Default to 1 when shown directly from register.vue
	return 1
})

// Privacy settings state - defaults per spec: stealth OFF, all toggles ON, links enabled
const stealthMode = ref(false)
const contractRegistry = ref(true)
const uploadExternalImages = ref(true)
const externalLinks = ref("enabled")

// Check if all privacy settings are disabled (for auto-enable stealth)
const isAllDisabled = computed(() => {
	return !contractRegistry.value && !uploadExternalImages.value && externalLinks.value === "disabled"
})

const settings = {
	stealthMode: {
		title: "Stealth Mode",
		description: "Disable all external service connections",
		model: stealthMode,
	},
	contractRegistry: {
		title: "Contract Registry",
		description: "Fetch contract info externally",
		model: contractRegistry,
	},
	uploadExternalImages: {
		title: "Upload external images",
		description: "Load images from external URLs",
		model: uploadExternalImages,
	},
	externalLinks: {
		title: "External links",
		description: "Control external link behavior",
		model: externalLinks,
	},
}

// Enable stealth mode: turn off all settings
async function enableStealthMode() {
	stealthMode.value = true
	contractRegistry.value = false
	uploadExternalImages.value = false
	externalLinks.value = "disabled"

	// Save to config immediately
	await configService.setValue("stealthMode", true)
	await configService.setValue("contractRegistry", false)
	await configService.setValue("uploadExternalImages", false)
	await configService.setValue("externalLinks", "disabled")
}

// Disable stealth mode: turn on all settings
async function disableStealthMode() {
	stealthMode.value = false
	contractRegistry.value = true
	uploadExternalImages.value = true
	externalLinks.value = "enabled"

	// Save to config immediately
	await configService.setValue("stealthMode", false)
	await configService.setValue("contractRegistry", true)
	await configService.setValue("uploadExternalImages", true)
	await configService.setValue("externalLinks", "enabled")
}

async function updateSetting(key, value) {
	if (key === "stealthMode") {
		if (value) {
			await enableStealthMode()
		} else {
			await disableStealthMode()
		}
		return
	}

	// Update the individual setting
	settings[key].model.value = value
	await configService.setValue(key, value)

	// If stealth is on and user enables something, turn stealth off
	if (stealthMode.value && value) {
		stealthMode.value = false
		await configService.setValue("stealthMode", false)
	}

	// Auto-enable stealth when all settings are disabled
	if (isAllDisabled.value && !stealthMode.value) {
		stealthMode.value = true
		await configService.setValue("stealthMode", true)
	}
}

function handleCreateProfile() {
	// Settings are already saved to config, just emit to trigger profile creation
	// Pass a marker object so RegisterPopup knows user came from promo flow
	emit("onCreateProfile", { fromPromoFlow: true })
}

function handleClose() {
	emit("onClose")
}

// Load current config values when popup opens
watch(
	() => props.show,
	async () => {
		if (props.show) {
			// Load current values from config (defaults: stealth OFF, all ON, links enabled)
			stealthMode.value = await configService.getValue("stealthMode")
			contractRegistry.value = await configService.getValue("contractRegistry")
			uploadExternalImages.value = await configService.getValue("uploadExternalImages")
			externalLinks.value = await configService.getValue("externalLinks")
		}
	},
)

onBeforeUnmount(() => {
	configService.disconnect()
})
</script>

<template>
	<!-- Fixed overlay to cover register page when shown directly -->
	<Teleport to="#popup">
		<Transition name="fade">
			<div v-if="show" :class="$style.overlay" />
		</Transition>
	</Teleport>

	<Popup :show @onClose="handleClose" :displaceIdx="displaceIdx">
		<PopupCard :displaceIdx>
			<Flex direction="column" gap="24" :class="$style.wrapper" wide>
				<!-- Header -->
				<Flex direction="column" align="center" gap="12">
					<Icon name="eye-off" size="24" color="green" />
					<Text size="16" weight="600" color="primary">Privacy Settings</Text>
					<Text size="13" weight="500" color="tertiary" align="center">
						Configure how your wallet interacts with external services
					</Text>
				</Flex>

				<!-- Settings -->
				<Flex direction="column" gap="16" :class="$style.settings">
					<!-- Stealth Mode Master Toggle -->
					<Flex align="center" justify="between">
						<Flex direction="column" justify="center" gap="4">
							<Text size="13" weight="600" color="primary">{{ settings.stealthMode.title }}</Text>
							<Text size="11" weight="500" color="tertiary">{{ settings.stealthMode.description }}</Text>
						</Flex>
						<Toggle
							@update:modelValue="updateSetting('stealthMode', $event)"
							:modelValue="settings.stealthMode.model.value"
						/>
					</Flex>

					<Flex :class="$style.divider" />

					<!-- Toggle Settings -->
					<template v-for="sk in ['contractRegistry', 'uploadExternalImages']" :key="sk">
						<Flex align="center" justify="between">
							<Flex direction="column" justify="center" gap="4">
								<Text size="13" weight="600" color="primary">{{ settings[sk].title }}</Text>
								<Text size="11" weight="500" color="tertiary">{{ settings[sk].description }}</Text>
							</Flex>
							<Toggle
								@update:modelValue="updateSetting(sk, $event)"
								:modelValue="settings[sk].model.value"
							/>
						</Flex>
					</template>

					<!-- External Links Dropdown -->
					<Flex justify="between" align="center">
						<Flex direction="column" gap="4">
							<Text size="13" weight="600" color="primary">{{ settings.externalLinks.title }}</Text>
							<Text size="11" weight="500" color="tertiary">{{ settings.externalLinks.description }}</Text>
						</Flex>

						<Dropdown>
							<template #trigger>
								<DropdownTrigger :class="$style.dropdownTrigger">
									<Text size="12" weight="600" color="primary" style="text-transform: capitalize">
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
				</Flex>

				<!-- Buttons -->
				<Flex direction="column" gap="8">
					<Button @click="handleCreateProfile" type="primary" size="medium" wide>
						<Flex align="center" gap="6">
							<Text size="13">Create Profile</Text>
							<Icon name="arrow-circle-broken-right" size="16" />
						</Flex>
					</Button>
					<Button @click="handleClose" type="primary_outline" size="medium" wide>
						Back
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.settings {
	max-height: 280px;
	overflow-y: auto;
}

.divider {
	height: 1px;
	background: var(--nulo-surface-high);
	margin: 0 -20px;
	padding: 0 20px;
}

.dropdownTrigger {
	min-width: 80px;
	display: flex;
	align-items: center;
	gap: 6px;
}

.overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(10, 9, 8, 0.8);
	z-index: 399;
}
</style>
