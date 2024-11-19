<script setup>
/** Components */
import Header from "@/components/Header.vue"
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"

/** Utils */
import { managers, initNetworks } from "@/utils/core.js"
import { AccountServiceClient } from "@/wallet/services/account/client"

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

	appStore.accounts = await managers.account.getAccounts()
	await appStore.setupActiveAccount()
}

const init = async () => {
	await appStore.setTheme()
	const root = document.querySelector("html")
	if (appStore.theme) root.setAttribute("theme", appStore.theme)

	const networks = await initNetworks()
	appStore.networks = networks
	appStore.network = networks[0]

	const activeProfile = await managers.profile.getActiveProfile()
	if (activeProfile) {
		appStore.profile = activeProfile

		await initAccount()

		appStore.isLogined = true

		router.push("/popup/general")
		return
	}

	const profiles = await managers.profile.getProfiles()
	if (profiles.length) {
		appStore.profile = profiles[0]

		await initAccount()

		router.push("/popup/auth")
		return
	}

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

		<div>
			<PopupManager />
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
