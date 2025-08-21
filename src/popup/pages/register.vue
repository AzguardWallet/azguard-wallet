<route lang="json">
{
	"meta": {
		"isAuthRequired": false
	}
}
</route>

<script setup>
/** Components */
import RegisterPopup from "../components/popups/RegisterPopup/RegisterPopup.vue"

/** Utils */
import { SettingServiceClient } from "@/wallet/services/settings/client"
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const theme = ref(DEFAULT_SETTINGS?.theme || "dark")
const isSidePanelEnabled = ref(DEFAULT_SETTINGS?.sidePanel)
let settingService = null

function onSettingUpdate(setting) {
	if (setting.key === "theme") {
		theme.value = setting.value
	}
}

const handleOpen = target => {
	chrome.windows.create({
		type: "popup",
		url: `https://azguardwallet.io/${target}`,
		width: 360,
		height: 600,
	})
}

async function handleSwitchTheme () {
	try {
		const newTheme = theme.value === "dark" ? "light" : "dark"
		await settingService.updateSetting("theme", newTheme)
		theme.value = newTheme
	} catch (err) {
		console.error(`Failed theme updating ${err}`);
	}
}

async function handleSwitchAppView () {
	try {
		await settingService.updateSetting("sidePanel", !isSidePanelEnabled.value)
		isSidePanelEnabled.value = !isSidePanelEnabled.value
		if (isSidePanelEnabled.value) {
			const currentWindow = await chrome.windows.getCurrent()
			chrome.sidePanel.open({
				windowId: currentWindow.id,
			})
			
		}

		window.close()
	} catch (err) {
		console.error(`Failed side panel updating ${err}`);
	}
}

onMounted(async () => {
	settingService = new SettingServiceClient(undefined, undefined, onSettingUpdate)
	theme.value = (await settingService.getSetting("theme"))?.value
	isSidePanelEnabled.value = (await settingService.getSetting("sidePanel"))?.value
})

onBeforeUnmount(() => {
	settingService.dispose()
})
</script>

<template>
	<Flex wide direction="column" align="center" justify="between" :class="$style.wrapper">
		<Flex align="center" justify="end" gap="4" wide :class="$style.settings">
			<Icon
				@click="handleSwitchTheme"
				:name="theme === 'dark' ? 'sun' : 'moon'"
				size="16"
				color="tertiary"
				:class="$style.icon"
			/>
			<Icon
				@click="handleSwitchAppView"
				name="dock-right"
				size="16"
				color="tertiary"
				:class="$style.icon"
			/>
		</Flex>

		<Flex direction="column" align="center" gap="16">
			<Text size="32" weight="500" align="center" :class="$style.title"> Privacy of finances is paramount </Text>
			<Text size="14" weight="500" color="body" height="140" align="center" :class="$style.description">
				Get power of privacy on Ethereum with Aztec Blockchain
			</Text>

			<Button type="secondary" size="mini" disabled>
				<Icon name="warning" size="16" color="orange" />
				Azguard Alpha Testing
			</Button>
		</Flex>

		<Flex direction="column" gap="12" align="center" :class="$style.bottom">
			<Flex wide direction="column" gap="8">
				<Button @click="appStore.showRegisterPopup = true" size="medium" type="primary" wide>
					<Flex align="center" gap="6">
						<Text size="13">Create Profile</Text>
						<Icon name="arrow-circle-broken-right" size="16" />
					</Flex>
				</Button>
				<Button @click="popupStore.open('import')" size="medium" type="secondary" wide> Import Profile </Button>
			</Flex>

			<Text size="11" weight="500" color="tertiary" height="140" align="center">
				By continuing, you are confirming that you read and agree to

				<Text @click="handleOpen('terms')" color="secondary" :class="$style.link"> Terms of Use </Text>
				and
				<Text @click="handleOpen('privacy')" color="secondary" :class="$style.link"> Privacy Policy </Text>
			</Text>
		</Flex>

		<Transition name="slide">
			<RegisterPopup v-if="appStore.showRegisterPopup" />
		</Transition>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;
	overflow: hidden;

	height: 100%;

	padding-top: 170px;
	margin: 0 auto;
}

.settings {
	position: absolute;
	top: 16px;
	right: 16px;

	.icon {
		box-sizing: content-box;
		border-radius: 50%;
		cursor: pointer;

		padding: 4px;

		&:hover {
			background: var(--gray-10);
			fill: var(--txt-primary);
		}
	}
}

.title {
	max-width: 300px;

	font-family: "Clash Display";

	background-image: linear-gradient(var(--txt-primary), var(--txt-secondary));
	background-clip: text;
	background-size: 100%;
	-webkit-text-fill-color: transparent;
}

.description {
	max-width: 240px;
}

.bottom {
	max-width: 260px;

	margin-bottom: 24px;

	transition: all 0.5s var(--bezier);
}

.link {
	cursor: pointer;

	&:hover {
		color: var(--txt-primary);
	}
}
</style>
