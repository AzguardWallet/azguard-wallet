<script setup>
/** Components */
import Header from "@/components/Header.vue"
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"

/** Utils */
import { managers, initNetworks, initTokenService, initTransactionService } from "@/utils/core.js"
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { AccountServiceClient, AccountType } from "@/wallet/services/account/client"
import { InteractionServiceClient } from "@/wallet/services/interaction/client"

/** Composables */
import { useSettings } from "@/composables/settings.js"
const { syncLocalSettings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

import LogoIcon from "@/assets/logo.svg?raw"

const route = useRoute()
const router = useRouter()

const initAccount = async () => {
	managers.account = new AccountServiceClient(appStore.profile, appStore.network)
	appStore.accounts = await managers.account.getAccounts(true)
	await appStore.setupActiveAccount()
}

// Update appStore
const uploadDappSessions = async () => {
	appStore.dappSessions = await managers.interaction.getDappSessions(appStore.profile.id)
}
const interactionServiceClient = new InteractionServiceClient(undefined, undefined, uploadDappSessions, uploadDappSessions)

/** todo: ref */
watch(
	() => appStore.account,
	() => {
		if (!appStore.account || !appStore.isLogined) return

		appStore.syncBalances()
		appStore.syncTransactions()
	},
)
/** todo: ref */
watch(
	() => appStore.network,
	async () => {
		if (!appStore.isLogined) return

		managers.account = new AccountServiceClient(appStore.profile, appStore.network)
		appStore.accounts = await managers.account.getAccounts(true)

		if (!appStore.accounts.length) {
			await managers.account.createAccount(AccountType.Azguard_v0, "Account")
			appStore.accounts = await managers.account.getAccounts(true)
			await appStore.setupActiveAccount()

			await appStore.syncLocalTokens()

			console.log(appStore.account)
		} else {
			await appStore.setupActiveAccount()

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
			await appStore.syncBalances()
			await appStore.syncTransactions()
			appStore.initBalanceListeners()
		}
	},
)

const loadProfile = async () => {
	const activeProfile = await managers.profile.getActiveProfile()
	if (activeProfile) {
		appStore.profile = activeProfile

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

		managers.profile.onLocked = () => {
			appStore.isLogined = false
			router.push("/popup/auth")
		}

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

			await initAccount()
			await uploadDappSessions()

			appStore.isSessionChecked = true

			router.push("/popup/auth")
			return
		}
	} else {
		await initAccount()
	}

	appStore.isSessionChecked = true
}
const init = async () => {
	/**
	 * Settings: theme, side panel, ...
	 */
	await syncLocalSettings()

	/**
	 * Wallet init: networks, active profile, etc
	 */
	const networks = await initNetworks()
	appStore.networks = networks

	const activeNetworkResult = await chrome.storage.local.get("azguard:ui:activeNetwork")

	if ("azguard:ui:activeNetwork" in activeNetworkResult) {
		const localActiveNetworkIdx = activeNetworkResult["azguard:ui:activeNetwork"]
		const localActiveNetwork = appStore.networks.findLast(n => n.id === localActiveNetworkIdx)
		appStore.network = localActiveNetwork || appStore.networks.findLast(n => n.isDefault)
		managers.network.setDefault(appStore.network.id)
	} else {
		appStore.network = networks.findLast(n => n.isDefault)
		managers.network.setDefault(appStore.network.id)
	}

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
		appStore._isHomeScreenOpened = route.name === "popup-register" || route.name.includes("windows-")
	}
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
