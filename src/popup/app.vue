<script setup>
/** Components */
import Header from "@/components/Header.vue"
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"
import GlobalLoader from "@/components/ui/GlobalLoader.vue"

/** Utils */
import { getChainPosition } from "@/components/ui/utils"
import { managers, initTokenService, initTransactionService, isBackgroundConnected } from "@/utils/core.js"
import { isPrefersDarkScheme } from "@/utils/general"
import { AccountServiceClient, AccountType } from "@/wallet/services/account/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { SettingServiceClient } from "@/wallet/services/settings/client"
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

/** Update theme */
const root = document.querySelector("html")
const theme = ref(DEFAULT_SETTINGS?.theme || "dark")
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
	if (theme.value === "system") root.setAttribute("theme", isPrefersDarkScheme() ? "dark" : "light")
})

import LogoIcon from "@/assets/logo.svg?raw"

const route = useRoute()
const router = useRouter()

let settingService = null
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
			openPanelOnActionClick: Boolean(value)
		})
	}
}
function applySetting(setting) {
	const handler = settingHandlers[setting.key];
	if (typeof handler === "function") {
		handler(setting.value);
	}
}

const initNetworks = async () => {
	managers.network?.dispose()
	appStore.networks = []
	appStore.network = null

	managers.network = new NetworkServiceClient()
	appStore.networks = (await managers.network.getOrInitNetworks()).sort((a, b) => {
		const aPos = getChainPosition(a.chainId)
		const bPos = getChainPosition(b.chainId)
		return aPos === bPos ? a.name.localeCompare(b.name) : aPos - bPos
	})

	const key = `azguard:ui:lastActiveNetwork@${appStore.profile?.id}`
	const lastActiveNetworkId = (await chrome.storage.local.get(key))[key]
	
	if (lastActiveNetworkId) {
		appStore.network = appStore.networks.find(n => n.id === lastActiveNetworkId)
	}
	if (!appStore.network) {
		appStore.network = appStore.networks.find(n => n.isDefault)
		chrome.storage.local.set({ [key]: appStore.network.id })
	}
	
	managers.network.setDefault(appStore.network.id)
}

const initAccount = async () => {
	managers.account = new AccountServiceClient(appStore.profile, appStore.network)

	appStore.accounts = await managers.account.getAccounts(true)

	/** temp */
	if (!appStore.accounts.length) {
		await managers.account.createAccount(AccountType.Azguard_v0, "Account")
		appStore.accounts = await managers.account.getAccounts(true)
	}

	await appStore.setupActiveAccount()
}

// Update appStore
const uploadDappSessions = async () => {
	appStore.dappSessions = await managers.dappSession.getDappSessions()
}
const dappSessionServiceClient = new DappSessionServiceClient(
	undefined,
	undefined,
	uploadDappSessions,
	uploadDappSessions,
	uploadDappSessions,
)

/** todo: ref */
watch(
	() => appStore.account,
	() => {
		if (!appStore.account || !appStore.isLogined) return

		appStore.syncBalances()
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

		managers.account = new AccountServiceClient(appStore.profile, appStore.network)
		appStore.accounts = await managers.account.getAccounts(true)

		if (!appStore.accounts.length) {
			await managers.account.createAccount(AccountType.Azguard_v0, "Account")
			appStore.accounts = await managers.account.getAccounts(true)
			await appStore.setupActiveAccount()

			initTokenService({
				profile: appStore.profile,
				network: appStore.network,
				account: appStore.account,
				onTokenAdded: appStore.onTokenAdded,
			})
			await appStore.syncLocalTokens()
			await appStore.syncTransactions()
		} else {
			await appStore.setupActiveAccount()

			initTokenService({
				profile: appStore.profile,
				network: appStore.network,
				account: appStore.account,
				onTokenAdded: appStore.onTokenAdded,
			})

			await appStore.syncLocalTokens()
			await appStore.syncBalances()
			await appStore.syncTransactions()
			appStore.initBalanceListeners()
		}
	},
)

const loadProfile = async () => {
	// TODO: set event handlers in client's constructor instead
	managers.profile.onActiveProfileChanged = async profile => {
		if (profile) {
			appStore.profile = profile

			await initNetworks()
			await initAccount()
			await uploadDappSessions()

			appStore.isLogined = true
			// TODO: initialize all services here
			// TODO: redirect to /general
		} else {
			// TODO: deinitialize all services here
			popupStore.closeAll()
			appStore.isLogined = false
			router.push("/popup/auth")
		}
	}

	appStore.profiles = await managers.profile.getProfiles()
	const activeProfile = await managers.profile.getActiveProfile()
	if (activeProfile) {
		appStore.profile = activeProfile

		await initNetworks()
		await initAccount()
		await uploadDappSessions()

		initTokenService({
			profile: appStore.profile,
			network: appStore.network,
			account: appStore.account,
			onTokenAdded: appStore.onTokenAdded,
		})
		initTransactionService(appStore.onTxAdded, appStore.onTxUpdated)

		await appStore.syncLocalTokens()
		appStore.syncBalances()
		await appStore.syncTransactions()
		appStore.initBalanceListeners()

		appStore.isLogined = true
		appStore.isSessionChecked = true

		if (["popup-register"].includes(route.name)) router.push("/popup/general")

		return
	}

	if (!appStore.profile) {
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

	settingService = new SettingServiceClient(undefined, undefined, applySetting)
	const settings = await settingService.getSettings()
	settings.forEach(applySetting)

	loadProfile()
})

onMounted(async () => {
	/** DevTools Warnings -> Logo + Scam Prevention */
	const svgDataUrl = `data:image/svg+xml;base64,${btoa(LogoIcon)}`

	console.log(
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
	console.log("%cHold up!", styleTitle)
	console.log(
		"%cIf someone asks you to do something in this interface (DevTools), 100% they are trying to scam you. If you don't know what you are doing, close this window (cross in the upper right corner).",
		styleText,
	)
	console.log("%cYou can report a scam through the form: https://azguardwallet.io/forms/report-scam", styleText)
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
	}
)

onBeforeUnmount(() => {
	clearInterval(intervalId)
	settingService?.dispose()
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
