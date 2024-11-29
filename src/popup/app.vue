<script setup>
/** Components */
import Header from "@/components/Header.vue"
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"

/** Utils */
import { managers, initNetworks, initTokenService } from "@/utils/core.js"
import { AccountServiceClient } from "@/wallet/services/account/client"

/** Composables */
import { useSettings } from "@/composables/settings.js"
const { syncLocalSettings } = useSettings()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const route = useRoute()
const router = useRouter()

const initAccount = async () => {
	appStore.setWalletCreatedAt()

	managers.account = new AccountServiceClient(
		appStore.profile,
		appStore.network
	)

	appStore.accounts = await managers.account.getAccounts(true)

	await appStore.setupActiveAccount()
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
	appStore.network = networks[0]
	managers.network.setDefault(appStore.network.id)

	const activeProfile = await managers.profile.getActiveProfile()
	if (activeProfile) {
		appStore.profile = activeProfile

		await initAccount()

		initTokenService({
			profile: appStore.profile,
			network: appStore.network,
			account: appStore.account,
		})
		await appStore.syncLocalTokens()
		await appStore.syncBalances()
		appStore.initBalanceListeners()

		appStore.isLogined = true
		appStore.isSessionChecked = true

		if (["popup-register"].includes(route.name))
			router.push("/popup/general")

		return
	}

	const profiles = await managers.profile.getProfiles()
	if (profiles.length) {
		appStore.profile = profiles[0]

		await initAccount()

		appStore.isSessionChecked = true

		router.push("/popup/auth")
		return
	}

	appStore.isSessionChecked = true

	router.push("/popup/register")
}
init()

watch(
	() => route.name,
	() => {
		appStore._isHomeScreenOpened = route.name === "popup-register"
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
			<Transition name="navigation" mode="out-in">
				<component :is="Component"></component>
			</Transition>
		</RouterView>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;

	overflow: hidden;
}
</style>
