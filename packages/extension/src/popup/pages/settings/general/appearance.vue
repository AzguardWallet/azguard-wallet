<route lang="json">
{
	"meta": {
		"title": "Appearance",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"
import Navigation from "../../../components/Navigation.vue"

/** Utils */
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

const isLoading = ref(true)
const defaultConfig = new Config()
const theme = ref(defaultConfig.theme)
const isSidePanelEnabled = ref(defaultConfig.sidePanel)
const isShowNodeNameEnabled = ref(defaultConfig.showNode)
const isShowPopupFullscreen = ref(defaultConfig.showPopupFullscreen)
const isAnimationsDisabled = ref(defaultConfig.disableAnimations)
const settings = {
	theme: {
		title: "",
		description: "",
		model: theme,
	},
	sidePanel: {
		title: "Open as Side Panel",
		description: "Open as side panel instead of popup",
		model: isSidePanelEnabled,
	},
	showNode: {
		title: "Show network name",
		description: "Always show network name in the header",
		model: isShowNodeNameEnabled,
	},
	showPopupFullscreen: {
		title: "Full-height popups",
		description: "Open popups to to the full height",
		model: isShowPopupFullscreen,
	},
	disableAnimations: {
		title: "Disable animations",
		description: "Minimize the use of animations",
		model: isAnimationsDisabled,
	},
}

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
		case "sidePanel":
			if (value) {
				const currentWindow = await chrome.windows.getCurrent()
				chrome.sidePanel.open({
					windowId: currentWindow.id,
				})
			}

			window.close()
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

onMounted(async () => {
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
	<Flex v-if="!isLoading" direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="24">
			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Dark Theme </Text>
					<Text size="12" weight="500" color="tertiary"> Application theme </Text>
				</Flex>

				<Dropdown>
					<template #trigger>
						<DropdownTrigger>
							<Icon
								:name="
									(theme === 'dark' && 'moon') ||
									(theme === 'light' && 'sun') ||
									(theme === 'system' && 'settings')
								"
								size="14"
								color="primary"
							/>
							<Text size="13" weight="600" color="primary" style="text-transform: capitalize">
								{{ theme }}
							</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem @click="updateSetting('theme', 'dark')">
							<Flex align="center" gap="8">
								<Icon :name="theme === 'dark' ? 'check' : ''" size="14" color="primary" />
								Dark
							</Flex>
						</DropdownItem>
						<DropdownItem @click="updateSetting('theme', 'light')">
							<Flex align="center" gap="8">
								<Icon :name="theme === 'light' ? 'check' : ''" size="14" color="primary" />
								Light
							</Flex>
						</DropdownItem>
						<DropdownItem @click="updateSetting('theme', 'system')">
							<Flex align="center" gap="8">
								<Icon :name="theme === 'system' ? 'check' : ''" size="14" color="primary" />
								System
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex v-for="sk in Object.keys(settings).filter(sk => sk !== 'theme')" justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> {{ settings[sk].title }} </Text>
					<Text size="12" weight="500" color="tertiary"> {{ settings[sk].description }} </Text>
				</Flex>

				<Toggle
					@update:modelValue="updateSetting(sk, $event)"
					:modelValue="settings[sk].model.value"
				/>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);

	padding: 16px 24px 96px 24px;
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
