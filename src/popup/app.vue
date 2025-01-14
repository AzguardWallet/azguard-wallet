<script setup>
/** Components */
import Header from "@/components/Header.vue"
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"

/** Utils */
import { managers, initTokenService, initTransactionService } from "@/utils/core.js"
import { isPrefersDarkScheme } from "@/utils/general"
import { AccountServiceClient, AccountType } from "@/wallet/services/account/client"
import { InteractionServiceClient } from "@/wallet/services/interaction/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"

/** Composables */
import { useSettings } from "@/composables/settings.js"
const { settings, syncLocalSettings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

/** Update theme */
const root = document.querySelector("html")
const theme = computed(() => settings.value.appearance?.theme)
watch(
	() => theme.value,
	() => {
		if (theme.value === "system") {
			root.setAttribute("theme", isPrefersDarkScheme() ? "dark" : "light")
		} else {
			root.setAttribute("theme", theme.value)
		}
	},
)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
	if (theme.value === "system") root.setAttribute("theme", isPrefersDarkScheme() ? "dark" : "light")
})

watch(
	() => settings.value,
	() => {
		if (settings.value.appearance.disableAnimations) {
			document.querySelector("html").classList.add("noanimations")
		}
	},
)

import LogoIcon from "@/assets/logo.svg?raw"

const route = useRoute()
const router = useRouter()

const initNetworks = async () => {
	managers.network = new NetworkServiceClient()
	appStore.networks = (await managers.network.getOrInitNetworks()).sort((a, b) =>
		a.chainId === b.chainId ? a.name.localeCompare(b.name) : a.chainId - b.chainId,
	)
	const activeNetworkResult = await chrome.storage.local.get("azguard:ui:activeNetwork")
	if ("azguard:ui:activeNetwork" in activeNetworkResult) {
		const localActiveNetworkId = activeNetworkResult["azguard:ui:activeNetwork"]
		appStore.network = appStore.networks.find(n => n.id === localActiveNetworkId)
	}
	appStore.network ??= appStore.networks.findLast(n => n.isDefault) // TODO: change to .find() after dropping shared pxe
	managers.network.setDefault(appStore.network.id)
	appStore.syncNetworkStatus()
}

const initAccount = async () => {
	managers.account = new AccountServiceClient(appStore.profile, appStore.network)
	appStore.accounts = await managers.account.getAccounts(true)
	await appStore.setupActiveAccount()
}

// Update appStore
const uploadDappSessions = async () => {
	appStore.dappSessions = await managers.interaction.getDappSessions(appStore.profile.id)
}
const interactionServiceClient = new InteractionServiceClient(
	undefined,
	undefined,
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
		if (!appStore.isLogined) return

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
			})
			await appStore.syncLocalTokens()
		} else {
			await appStore.setupActiveAccount()

			initTokenService({
				profile: appStore.profile,
				network: appStore.network,
				account: appStore.account,
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
		})
		initTransactionService(tx => {
			appStore.transactions.unshift(tx)
			appStore.isAwaitingTransaction = false
		})

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
		const profiles = await managers.profile.getProfiles()
		if (profiles.length) {
			appStore.profile = profiles[0]

			appStore.isSessionChecked = true

			router.push("/popup/auth")
			return
		}
	}

	appStore.isSessionChecked = true
}
const init = async () => {
	/**
	 * Settings: theme, side panel, ...
	 */
	await syncLocalSettings()

	/**
	 * Wallet init: active profile, etc
	 */
	loadProfile()
}

onBeforeMount(async () => {
	await router.isReady()
	init()
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
})

watch(
	() => route.name,
	() => {
		if (appStore.isLogined) {
			const _ = managers.profile?.refreshSession()
		}

		appStore._isHomeScreenOpened = route.name === "popup-register" || route.name.includes("windows-")
	},
)
</script>

<template>
	<LogoStar />

	<Flex wide direction="column" :class="$style.wrapper">
		<!-- Popup Teleport -->
		<div id="popup" />
		<div id="tooltip" />
		<div id="dropdown" />
		<div id="toast" />

		<div>
			<PopupManager />
			<ToastManager />
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
