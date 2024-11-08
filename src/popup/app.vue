<script setup>
/** Components */
import LogoStar from "@/components/LogoStar.vue"
import PopupManager from "./components/popups/PopupManager.vue"

/** Utils */
import { managers, initNetworks } from "@/utils/core.js"
import { AccountManager } from "@/wallet/accounts"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const route = useRoute()
const router = useRouter()

const initAccount = async () => {
	appStore.setWalletCreatedAt()

	managers.account = new AccountManager(appStore.profile, appStore.network)

	appStore.accounts = await managers.account.getAccounts()
	await appStore.setupActiveAccount()
}

const init = async () => {
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
		appStore._isHomeScreenOpened = route.name === "popup-register"
	}
)
// ;(async function f() {
// 	const pm = new ProfileManager()
// 	const nm = new NetworkManager()

// 	await chrome.storage.local.clear()

// 	console.log(
// 		"+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++"
// 	)

// 	console.log("local storage:", await chrome.storage.local.get())
// 	let networks = await nm.getNetworks()
// 	console.log("networks:", networks)
// 	console.log("local storage:", await chrome.storage.local.get())
// 	let network = await nm.getNetwork(networks[0].id)
// 	console.log("network:", networks)

// 	let newNetwork = await nm.addNetwork("qwe", "https://rpc.tzkt.io/aztec/")
// 	console.log("newNetwork:", newNetwork)
// 	networks = await nm.getNetworks()
// 	console.log("networks:", networks)
// 	console.log("local storage:", await chrome.storage.local.get())

// 	newNetwork = await nm.setNetwork(
// 		newNetwork.id,
// 		"zxczxc",
// 		"https://rpc.tzkt.io/aztec/"
// 	)
// 	console.log("newNetwork:", newNetwork)
// 	networks = await nm.getNetworks()
// 	console.log("networks:", networks)
// 	console.log("local storage:", await chrome.storage.local.get())

// 	console.log("deletion...")
// 	await nm.deleteNetwork(newNetwork.id)
// 	console.log("deleted")
// 	console.log("networks:", await nm.getNetworks())
// 	console.log("local storage:", await chrome.storage.local.get())

// 	console.log(
// 		"*********************************************************************************"
// 	)

// 	// если висит активная сессия, мы ее "продолжаем"
// 	console.log("session storage:", await chrome.storage.session.get())
// 	let activeProfile = await pm.getActiveProfile()
// 	console.log("active profile:", activeProfile)

// 	console.log("================")

// 	// если активной сессии нет, или она устарела, мы пытаемся показать список доступных профилей
// 	console.log("local storage:", await chrome.storage.local.get())
// 	let profiles = await pm.getProfiles()
// 	console.log("profiles:", profiles)

// 	console.log("================")

// 	// если доступных профилей нет, мы предлагаем создать
// 	let p = await pm.createProfile("Default Profile", "qwerty")
// 	console.log("created:", p)
// 	console.log("local storage:", await chrome.storage.local.get())
// 	// автоматом создается сессия
// 	console.log("session storage:", await chrome.storage.session.get())

// 	console.log("///////////////////////////////////////////////////")

// 	const am = new AccountManager(p, network!)

// 	let accounts = await am.getAccounts()
// 	console.log("accounts:", accounts)
// 	console.log("local storage:", await chrome.storage.local.get())

// 	let account = await am.createAccount(AccountType.SchnorrV0, "Acc1")
// 	console.log("created:", account)
// 	console.log("accounts:", await am.getAccounts())

// 	let acc = await am.getAccount(account.id)
// 	console.log("get:", acc)

// 	account = await am.changeAccountName(account, "AAACCC111")
// 	console.log("changed:", account)
// 	console.log("accounts:", await am.getAccounts())

// 	await am.deleteAccount(account)
// 	console.log("deleted:", account)
// 	console.log("accounts:", await am.getAccounts())
// 	console.log("local storage:", await chrome.storage.local.get())

// 	await nm.deleteNetwork(network!.id)

// 	console.log("///////////////////////////////////////////////////")

// 	// если же профили есть, мы предлагаем войти
// 	p = (await pm.signInProfile(p.id, "qwerty"))!
// 	console.log("signed in:", p)
// 	console.log("local storage:", await chrome.storage.local.get())
// 	// автоматом создается сессия
// 	console.log("session storage:", await chrome.storage.session.get())

// 	console.log("================")

// 	// при следующем входе уже будет доступна активная сессия
// 	activeProfile = await pm.getActiveProfile()
// 	console.log("active profile:", activeProfile)

// 	console.log("================")

// 	// если юзер выходит из профиля
// 	await pm.signOut()
// 	console.log("signed out")

// 	console.log("================")

// 	// сессия закрывается
// 	activeProfile = await pm.getActiveProfile()
// 	console.log("active profile:", activeProfile)

// 	console.log("================")

// 	// и надо заново авторизовываться
// 	profiles = await pm.getProfiles()
// 	console.log("profiles:", profiles)
// 	p = (await pm.signInProfile(p!.id, "qwerty"))!
// 	console.log("signed in:", p)
// 	console.log("local storage:", await chrome.storage.local.get())
// 	console.log("session storage:", await chrome.storage.session.get())

// 	console.log("================")

// 	// если удалить профиль, то он удалится и сессия закроется
// 	await pm.deleteProfile(p!)
// 	console.log("deleted")
// 	profiles = await pm.getProfiles()
// 	console.log("profiles:", profiles)
// 	console.log("local storage:", await chrome.storage.local.get())
// 	console.log("session storage:", await chrome.storage.session.get())

// 	console.log(
// 		"*********************************************************************************"
// 	)
// })()
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
