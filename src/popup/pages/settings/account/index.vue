<route lang="json">
{
	"meta": {
		"title": "Account Settings",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
import SettingField from "@/components/ui/Settings/SettingField.vue"
import SettingValue from "@/components/ui/Settings/SettingValue.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const router = useRouter()
const version = __VERSION__

const accounts = computed(() => appStore.accounts.filter(a => a.visible).sort((a, b) => a.index - b.index))
const isLoading = ref(false)

const handleCopyVersion = () => {
	window.navigator.clipboard.writeText(version)
	openToast({ label: "Version is copied", icon: "copy" })
}

const handleOpen = target => {
	chrome.windows.create({
		type: "popup",
		url: `https://azguardwallet.io/${target}`,
		width: 360,
		height: 600,
	})
}

const handleEditCurrentAccount = () => {
	cacheStore.accountToEditIdx = appStore.account.address
	popupStore.open("edit_account")
}

const handleHideAccount = async () => {
	if (accounts.value.length === 1) return
	isLoading.value = true

	const nextAccount = accounts.value.filter(acc => acc.address !== appStore.account.address)[0]
	try {
		await appStore.changeAccountVisibility(appStore.account, false)
		await appStore.selectAccount(nextAccount)

		openToast({ label: "Account successfully hidden" })

		router.go(-1)
	} catch (err) {
		console.error(err)
		openToast({ label: "Failed to hide account", icon: "error" })
	} finally {
		isLoading.value = false
	}
}

</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<Flex direction="column" gap="24" align="center">
			<Breadcrumbs />

			<PageHeader
				:title="appStore.account?.name || ''"
				description="Edit your account name or explore it on block explorer"
				icon="vault"
			/>

			<ItemsContainer wide>
				<SettingField
					@click="handleEditCurrentAccount"
					label="Name"
					:value="appStore.account?.name ?? ''"
					icon="edit"
				/>
				<SettingValue value="" label="Icon" icon="chevron-right" disabled>
					<template #value>
						<Icon name="vault" size="16" color="primary" />
					</template>
				</SettingValue>
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem
					to="/popup/settings/account/state"
					size="large"
					title="Account State"
					description="Notes, authwits, contracts, senders"
					icon="code-asterisk"
				/>
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem
					to="https://google.com"
					size="large"
					title="View on Explorer"
					description="Currently unavailable"
					icon="search"
					external
					disabled
				/>
			</ItemsContainer>

			<ItemsContainer wide>
				<SettingItem
					@click="handleHideAccount"
					title="Hide account"
					icon="eye-off"
					:loading="isLoading"
					:disabled="accounts.length === 1"
				/>
			</ItemsContainer>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}
</style>
