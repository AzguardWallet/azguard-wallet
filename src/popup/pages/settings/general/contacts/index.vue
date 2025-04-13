<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { trimAddress } from "@/utils/string"

/** Services */
import { AccountStateServiceClient } from "@/wallet/services/account-state/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const tabs = ["Recipients", "Senders"]
const activeTab = ref(tabs[1])

const senders = ref([])
const isLoading = ref(false)
const error = ref()
const fetchSenders = async () => {
	isLoading.value = true
	try {
		senders.value = await accountStateClientService.getSenders(appStore.network.id)
	} catch (err) {
		error.value = err
	} finally {
		isLoading.value = false
	}
}

const handleCopyAddress = (address) => {
	window.navigator.clipboard.writeText(address)
	openToast({ label: "Sender's address is copied", icon: "copy" })
}

const handleDelete = (sender) => {
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, delete sender"
	cacheStore.confirm.title = "Remove this sender?"
	cacheStore.confirm.description =
		"Removing a sender only affects transaction parsing — the wallet will no longer automatically recognize incoming transactions from this address"
	cacheStore.confirm.callback = async () => {
		await accountStateClientService.deleteSender(appStore.network.id, sender)

		openToast({ label: "Sender successfully deleted" })
	}

	popupStore.open("confirm")
}

const onSenderAdded = (sender) => {
	senders.value.push(sender)
}
const onSenderDeleted = (sender) => {
	senders.value = senders.value.filter((s) => s !== sender)
}
const accountStateClientService = new AccountStateServiceClient(undefined, undefined, onSenderAdded, onSenderDeleted)
watch(
	() => appStore.network,
	() => {
		if (appStore.network) fetchSenders()
	},
)
onMounted(() => {
	if (appStore.network) fetchSenders()
})
onBeforeUnmount(() => {
	accountStateClientService.dispose()
})
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="16">
			<Flex align="center" gap="8">
				<Text
					v-for="tab in tabs"
					@click="activeTab = tab"
					size="13"
					weight="600"
					:color="tab === activeTab ? 'primary' : 'tertiary'"
					:style="{
						transition: 'all 0.2s ease',
						cursor: 'pointer'
					}"
				>
					{{ tab }}
				</Text>
			</Flex>

			<template v-if="activeTab === 'Recipients'">
				<Flex align="center" justify="center" :style="{ paddingTop: '24px' }">
					<Text size="14" weight="600" color="tertiary"> No recipients yet </Text>
				</Flex>
			</template>

			<template v-else-if="activeTab === 'Senders'">
				<ItemsContainer v-if="senders.length">
					<SettingItem
						v-for="sender in senders"
						@click="handleCopyAddress(sender)"
						:title="trimAddress(sender, 8, 8)"
						icon="user"
						iconBgColor="transparent"
					>
						<template #right>
							<Tooltip position="end" delay="350">
								<Icon
									@click.stop="handleDelete(sender)"
									name="close-circle"
									size="14"
									color="tertiary"
									:class="$style.icon_btn"
								/>

								<template #content> Delete sender </template>
							</Tooltip>
						</template>
					</SettingItem>
				</ItemsContainer>
				<Flex v-else align="center" justify="center" gap="8" :style="{ paddingTop: '12px' }">
					<Text size="13" weight="600" color="tertiary"> No Senders found </Text>
				</Flex>

				<Button
					@click="popupStore.open('new_sender')"
					wide
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="primary"
				>
					<Text size="13">New sender</Text>
				</Button>
			</template>
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

.icon_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
