<script setup>
/** Components */
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"

/** Utils */
import { managers, initNetworks } from "@/utils/core.js"
import { AccountServiceClient } from "@/wallet/services/account/client"
import { InteractionServiceClient } from "@/wallet/services/interaction/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const route = useRoute()
const router = useRouter()

const initAccount = async () => {
	appStore.setWalletCreatedAt()

	managers.account = new AccountServiceClient(appStore.profile, appStore.network)

	appStore.accounts = await managers.account.getAccounts()
	await appStore.setupActiveAccount()
}

const uploadDappSessions = async () => {
	appStore.dappSessions = await managers.interaction.getDappSessions(appStore.profile.id)

	console.log('uploadDappSessions ', appStore.dappSessions);
	
}
const interactionServiceClient = new InteractionServiceClient(undefined, undefined, uploadDappSessions, uploadDappSessions)

const init = async () => {
	const networks = await initNetworks()
	appStore.networks = networks
	appStore.network = networks[0]

	const activeProfile = await managers.profile.getActiveProfile()
	if (activeProfile) {
		appStore.profile = activeProfile

		await initAccount()
		await uploadDappSessions()

		appStore.isLogined = true

		console.log('init route', route);
		
		// if (route.query.redirect) {
		// 	window.location.href = route.query.redirect
		// } else {
			
			// router.push("/popup/general")
		// }

		// router.push("/popup/general")

		if (route.name === "popup-settings-dappSessions-popup") {
			if (route.query.redirect) {
				window.location.href = route.query.redirect
			} else {
				router.push(route.fullPath)
			}
		} else {
			router.push("/popup/general")
		}

		return
	}

	const profiles = await managers.profile.getProfiles()
	if (profiles.length) {
		appStore.profile = profiles[0]

		await initAccount()
		await uploadDappSessions()

		router.push("/popup/auth")
		return
	}

	router.push("/popup/register")
}
init()

const handleOpenAccountsPopup = () => {
	if (!appStore.isLogined) return
	popupStore.open("accounts")
}

const handleOpenNetworksPopup = () => {
	if (!appStore.isLogined) return
	popupStore.open("networks")
}

watch(
	() => route.name,
	() => {
		appStore._isHomeScreenOpened = route.name === "popup-register" || route.name === "popup-settings-dappSessions-popup"
	}
)
</script>

<template>
	<LogoStar />

	<Flex wide direction="column" :class="$style.wrapper">
		<!-- Popup Teleport -->
		<div id="popup" />

		<div>
			<PopupManager />
		</div>

		<Flex
			v-if="!appStore._isHomeScreenOpened"
			align="center"
			justify="between"
			:class="$style.header"
		>
			<Flex
				@click="handleOpenAccountsPopup"
				align="center"
				justify="center"
				:class="[$style.button, !appStore.isLogined && $style.disabled]"
			>
				<Icon name="vault" size="18" color="blue" />
			</Flex>

			<Flex
				@click="handleOpenNetworksPopup"
				align="center"
				justify="center"
				:class="[$style.button, !appStore.isLogined && $style.disabled]"
			>
				<Icon name="globe" size="18" color="secondary" />
			</Flex>
		</Flex>

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

.header {
	margin: 12px 20px;
}

.button {
	width: 24px;
	height: 24px;

	border-radius: 50px;
	background: var(--gray-10);
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-15);
	}

	&:active {
		background: var(--gray-20);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}
</style>
