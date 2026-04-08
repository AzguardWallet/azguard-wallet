<script setup>
/** Components */
import Header from "@/components/Header.vue"
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"
import GlobalLoader from "@/components/ui/GlobalLoader.vue"

/** Utils */
import { managers, initTransactionService, isBackgroundConnected } from "@/utils/core.js"
import { isPrefersDarkScheme } from "@/utils/general"
import { Config } from "@/wallet/config"
import { AccountServiceClient, AccountType } from "@/wallet/services/account/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

/** Update theme */
const root = document.querySelector("html")
const theme = ref(new Config().theme)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
	if (theme.value === "system") root.setAttribute("theme", isPrefersDarkScheme() ? "dark" : "light")
})

import LogoIcon from "@/assets/logo.svg?raw"

const route = useRoute()
const router = useRouter()

const configService = new ConfigServiceClient()
configService.onUpdate.add(applySetting)

const intervalId = ref(null)

const settingHandlers = {
	theme(value) {
		theme.value = value
		if (value === "system") {
			root.setAttribute("theme", isPrefersDarkScheme() ? "dark" : "light")
		} else {
			root.setAttribute("theme", value)
		}
	},
	disableAnimations(value) {
		root.classList.toggle("noanimations", Boolean(value))
	},
	sidePanel(value) {
		chrome.sidePanel.setPanelBehavior({
			openPanelOnActionClick: Boolean(value),
		})
	},
	defaultExplorer(value) {
		appStore.defaultExplorer = value
	},
}
function applySetting(setting) {
	const handler = settingHandlers[setting.key]
	if (typeof handler === "function") {
		handler(setting.value)
	}
}

const initNetworks = async () => {
	appStore.networks = []
	appStore.network = null

	managers.network?.disconnect()
	managers.network = new NetworkServiceClient()

	appStore.networks = await managers.network.getOrInitNetworks()

	const activeNetworkResult = await chrome.storage.local.get("azguard:ui:activeNetwork")
	if ("azguard:ui:activeNetwork" in activeNetworkResult) {
		const localActiveNetworkId = activeNetworkResult["azguard:ui:activeNetwork"]
		appStore.network = appStore.networks.find((n) => n.id === localActiveNetworkId)
	}

	const key = `azguard:ui:lastActiveNetwork@${appStore.profile?.id}`
	const lastActiveNetworkId = (await chrome.storage.local.get(key))[key]

	if (lastActiveNetworkId) {
		appStore.network = appStore.networks.find((n) => n.id === lastActiveNetworkId)
	}
	if (!appStore.network) {
		appStore.network = appStore.networks.find((n) => n.isDefault)
		chrome.storage.local.set({ [key]: appStore.network.id })
	}

	managers.network.setDefault(appStore.network.id)
	appStore.syncNetworkStatus()
}

const initAccount = async () => {
	managers.account?.disconnect()
	managers.account = new AccountServiceClient()
	appStore.accounts = await managers.account.getAccounts(appStore.profile.id, appStore.network.chainId, true)

	/** temp */
	if (!appStore.accounts.length) {
		await managers.account.createAccount(appStore.profile.id, appStore.network.chainId, AccountType.Azguard_v0, "Account")
		appStore.accounts = await managers.account.getAccounts(appStore.profile.id, appStore.network.chainId, true)
	}

	await appStore.setupActiveAccount()
}

/** todo: ref */
watch(
	() => appStore.account,
	() => {
		if (!appStore.account || !appStore.isLogined) return

		if (managers.transaction) {
			appStore.syncTransactions()
		}
	},
)

/** todo: ref */
watch(
	() => appStore.network,
	async () => {
		if (!appStore.network) return

		appStore.syncNetworkStatus()

		managers.account?.disconnect()
		managers.account = new AccountServiceClient()
		appStore.accounts = await managers.account.getAccounts(appStore.profile.id, appStore.network.chainId, true)

		if (!appStore.accounts.length) {
			await managers.account.createAccount(appStore.profile.id, appStore.network.chainId, AccountType.Azguard_v0, "Account")
			appStore.accounts = await managers.account.getAccounts(appStore.profile.id, appStore.network.chainId, true)
			await appStore.setupActiveAccount()

			await appStore.syncTransactions()
		} else {
			await appStore.setupActiveAccount()

			await appStore.syncTransactions()
		}
	},
)

const onActiveProfileChanged = async (profile) => {
	if (profile) {
		appStore.profile = profile

		await initNetworks()
		await initAccount()

		initTransactionService(appStore.onTxAdded, appStore.onTxUpdated)
		await appStore.syncTransactions()

		appStore.isLogined = true
	} else {
		popupStore.closeAll()
		appStore.isLogined = false
		appStore.profiles = await managers.profile.getProfiles()
		router.push(appStore.profiles.length ? "/popup/auth" : "/popup/register")
	}
}

const loadProfile = async () => {
	managers.profile.onActiveProfileChanged.add(onActiveProfileChanged)

	appStore.profiles = await managers.profile.getProfiles()
	const activeProfile = await managers.profile.getActiveProfile()
	if (activeProfile) {
		appStore.profile = activeProfile

		await initNetworks()
		await initAccount()

		initTransactionService(appStore.onTxAdded, appStore.onTxUpdated)

		await appStore.syncTransactions()

		appStore.isLogined = true
		appStore.isSessionChecked = true

		if (["popup-register", "popup-auth"].includes(route.name)) router.push("/popup/general")

		return
	}

	if (!appStore.profile) {
		if (route.meta.isPasskeyInteraction) {
			return
		}

		if (appStore.profiles.length) {
			appStore.profile = appStore.profiles[0]

			appStore.isSessionChecked = true

			router.push("/popup/auth")
			return
		}
	}

	appStore.isSessionChecked = true
}

onBeforeMount(async () => {
	await router.isReady()

	const settings = await configService.getProps()
	settings.forEach(applySetting)

	await loadProfile()
})

onMounted(async () => {
	/** DevTools Warnings -> Logo + Scam Prevention */
	const svgDataUrl = `data:image/svg+xml;base64,${btoa(LogoIcon)}`

	console._log(
		"%c ",
		`
			background-image: url(${svgDataUrl});
			padding-bottom: 100px;
			padding-left: 100px;
			margin: 20px;
			background-size: contain;
			background-position: center center;
			background-repeat: no-repeat;
		`,
	)

	const styleTitle = "color: #fff; font-family: sans-serif; font-size: 10em;"
	const styleText =
		"color: #fff; font-family: sans-serif; font-size: 2em; padding: 40px; border-radius: 24px; border: 2px solid orange; background: #1f1f1f; line-height: 160%"
	console._log("%cHold up!", styleTitle)
	console._log(
		"%cIf someone asks you to do something in this interface (DevTools), 100% they are trying to scam you. If you don't know what you are doing, close this window (cross in the upper right corner).",
		styleText,
	)
	console._log("%cYou can report a scam through the form: https://azguardwallet.io/forms/report-scam", styleText)
	/****************** */

	intervalId.value = window.setInterval(() => {
		if (!appStore.isLogined) return

		const _ = managers.profile?.getActiveProfile()
	}, 10_000)
})

watch(
	() => route.name,
	() => {
		if (appStore.isLogined) {
			const _ = managers.profile?.refreshSession()
		}

		appStore._isHomeScreenOpened = route.name === "popup-register" || route.name?.includes("windows-")
	},
)

watch(
	() => isBackgroundConnected.value,
	() => {
		if (isBackgroundConnected.value) {
			loadProfile()
		}
	},
)

onBeforeUnmount(() => {
	clearInterval(intervalId.value)
	configService.disconnect()
})
</script>

<template>
	<LogoStar />

	<Flex wide direction="column" :class="$style.wrapper">
		<!-- Popup Teleport -->
		<div id="popup" />
		<div id="tooltip" />
		<div id="dropdown" />
		<div id="popover" />
		<div id="toast" />

		<div>
			<PopupManager />
			<ToastManager />
			<NotificationManager />
			<GlobalLoader />
		</div>

		<Header />

		<RouterView v-slot="{ Component }">
			<component :is="Component"></component>
		</RouterView>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;

	overflow: hidden;
}
</style>
