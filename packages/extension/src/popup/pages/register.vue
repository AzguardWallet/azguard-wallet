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
import StealthPromoPopup from "../components/popups/StealthPromoPopup.vue"

/** Utils */
import { Config } from "@/wallet/config"
import { ConfigServiceClient } from "@/wallet/services/config/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const defaultConfig = new Config()
const theme = ref(defaultConfig.theme)
const isSidePanelEnabled = ref(defaultConfig.sidePanel)

// Stealth promo visibility
const hasSeenStealthPromo = ref(true) // Default true to hide promo until we check
const showStealthPromo = ref(false)

const configService = new ConfigServiceClient()
configService.onUpdate.add(onSettingUpdate)

function onSettingUpdate(setting) {
	if (setting.key === "theme") {
		theme.value = setting.value
	}
}

const handleOpen = (target) => {
	chrome.windows.create({
		type: "popup",
		url: `https://nulo.sh/${target}`,
		width: 360,
		height: 600,
	})
}

async function handleSwitchTheme() {
	try {
		const newTheme = theme.value === "dark" ? "light" : "dark"
		await configService.setValue("theme", newTheme)
		theme.value = newTheme
	} catch (err) {
		console.error(`Failed theme updating ${err}`)
	}
}

async function handleSwitchAppView() {
	try {
		await configService.setValue("sidePanel", !isSidePanelEnabled.value)
		isSidePanelEnabled.value = !isSidePanelEnabled.value
		if (isSidePanelEnabled.value) {
			const currentWindow = await chrome.windows.getCurrent()
			chrome.sidePanel.open({
				windowId: currentWindow.id,
			})
		}

		window.close()
	} catch (err) {
		console.error(`Failed side panel updating ${err}`)
	}
}

function handleOpenStealthPromo() {
	showStealthPromo.value = true
}

function handleCloseStealthPromo() {
	showStealthPromo.value = false
}

function handleCreateProfileFromPromo(payload) {
	// Mark that user came from promo flow (settings already saved to config)
	cacheStore.privacySettings = payload
	// Close the stealth promo popup
	showStealthPromo.value = false
	// Open the register popup
	appStore.showRegisterPopup = true
}

onMounted(async () => {
	theme.value = await configService.getValue("theme")
	isSidePanelEnabled.value = await configService.getValue("sidePanel")
	hasSeenStealthPromo.value = (await configService.getValue("hasSeenStealthPromo")) || false
})

onBeforeUnmount(() => {
	configService.disconnect()
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
				Nulo Alpha Testing
			</Button>

			<!-- Stealth Mode Promo (only shown before first profile) -->
			<Flex
				v-if="!hasSeenStealthPromo"
				@click="handleOpenStealthPromo"
				align="center"
				gap="8"
				:class="$style.promo"
			>
				<Icon name="eye-off" size="16" color="green" />
				<Text size="12" weight="600" color="secondary">Try Stealth Mode for your wallet</Text>
				<Icon name="chevron-right" size="12" color="tertiary" />
			</Flex>
		</Flex>

		<Flex direction="column" gap="12" align="center" :class="$style.bottom">
			<Flex wide direction="column" gap="8">
				<Button @click="appStore.showRegisterPopup = true" wide type="primary" size="large">
					Create profile
				</Button>
				<Button @click="popupStore.open('import')" wide type="primary_outline" size="large">
					Import profile
				</Button>
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

		<!-- Stealth Promo Popup -->
		<StealthPromoPopup
			:show="showStealthPromo"
			@onClose="handleCloseStealthPromo"
			@onCreateProfile="handleCreateProfileFromPromo"
		/>
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
		cursor: pointer;

		padding: 6px;

		&:hover {
			background: var(--nulo-surface-high);
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

.promo {
	margin-top: 8px;
	padding: 10px 16px;
	background: var(--nulo-surface-low);
	border: 1px solid var(--nulo-border);
	cursor: pointer;
	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
		border-color: var(--nulo-outline);
	}
}
</style>
