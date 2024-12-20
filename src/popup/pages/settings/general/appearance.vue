<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
import { Dropdown, DropdownItem, DropdownTrigger } from "@/components/ui/Dropdown"

/** Composables */
import { useSettings } from "@/composables/settings.js"
const { settings, updateSettings } = useSettings()

const theme = computed(() => settings.value?.appearance?.theme)

const isSidePanelEnabled = ref(settings.value?.appearance?.sidePanel)
watch(
	() => isSidePanelEnabled.value,
	async () => {
		updateSettings("appearance", "sidePanel", isSidePanelEnabled.value)

		chrome.sidePanel.setPanelBehavior({
			openPanelOnActionClick: settings.value.appearance.sidePanel,
		})

		if (isSidePanelEnabled.value) {
			const currentWindow = await chrome.windows.getCurrent()
			chrome.sidePanel.open({
				windowId: currentWindow.id,
			})
			window.close()
		} else {
			window.close()
		}
	},
)

const isShowNodeNameEnabled = ref(settings.value?.appearance?.showNode)
watch(
	() => isShowNodeNameEnabled.value,
	async () => {
		updateSettings("appearance", "showNode", isShowNodeNameEnabled.value)
	},
)

const isShowPopupFullscreen = ref(settings.value?.appearance?.showPopupFullscreen)
watch(
	() => isShowPopupFullscreen.value,
	async () => {
		updateSettings("appearance", "showPopupFullscreen", isShowPopupFullscreen.value)
	},
)

const isAnimationsDisabled = ref(settings.value?.appearance?.disableAnimations)
watch(
	() => isAnimationsDisabled.value,
	async () => {
		updateSettings("appearance", "disableAnimations", isAnimationsDisabled.value)

		if (isAnimationsDisabled.value) {
			document.querySelector("html").classList.add("noanimations")
		} else {
			document.querySelector("html").classList.remove("noanimations")
		}
	},
)
</script>

<template>
	<Flex v-if="settings" direction="column" gap="20" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Settings </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/general">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> General </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Appearance </Text>
		</Flex>

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
								:name="(theme === 'dark' && 'moon') || (theme === 'light' && 'sun')"
								size="14"
								color="primary"
							/>
							<Text size="13" weight="600" color="primary" style="text-transform: capitalize">
								{{ settings.appearance.theme }}
							</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem @click="updateSettings('appearance', 'theme', 'dark')">
							<Flex align="center" gap="8">
								<Icon :name="theme === 'dark' ? 'check' : ''" size="14" color="primary" />
								Dark
							</Flex>
						</DropdownItem>
						<DropdownItem @click="updateSettings('appearance', 'theme', 'light')">
							<Flex align="center" gap="8">
								<Icon :name="theme === 'light' ? 'check' : ''" size="14" color="primary" />
								Light
							</Flex>
						</DropdownItem>
						<DropdownItem disabled>
							<Flex align="center" gap="8">
								<Icon :name="theme === 'system' ? 'check' : ''" size="14" color="primary" />
								System
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Open as Side Panel </Text>
					<Text size="12" weight="500" color="tertiary"> Open as side panel instead of popup </Text>
				</Flex>

				<Toggle v-model="isSidePanelEnabled" />
			</Flex>

			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Show Node name </Text>
					<Text size="12" weight="500" color="tertiary"> Always show node name in the header </Text>
				</Flex>

				<Toggle v-model="isShowNodeNameEnabled" />
			</Flex>

			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Full-height popups </Text>
					<Text size="12" weight="500" color="tertiary"> Open popups to to the full height </Text>
				</Flex>

				<Toggle v-model="isShowPopupFullscreen" />
			</Flex>

			<Flex justify="between">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary"> Disable animations </Text>
					<Text size="12" weight="500" color="tertiary"> Minimize the use of amination </Text>
				</Flex>

				<Toggle v-model="isAnimationsDisabled" />
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
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
