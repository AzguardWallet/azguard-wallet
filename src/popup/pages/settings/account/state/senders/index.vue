<route lang="json">
{
	"meta": {
		"title": "Senders",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"

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

const senders = ref([])
const isLoading = ref(false)
const isCopied = ref(false)
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
	isCopied.value = true

	window.navigator.clipboard.writeText(address)
	openToast({ label: "Sender's address is copied", icon: "copy" })

	setTimeout(() => {
		isCopied.value = false
	}, 2_000)
}

const handleDelete = (sender) => {
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.confirm_text = "Yes, delete sender"
	cacheStore.confirm.title = "Delete this sender?"
	cacheStore.confirm.description =
		"If you delete a sender, further private transactions from that sender won’t appear in your wallet"
	cacheStore.confirm.callback = async () => {
		await accountStateClientService.deleteSender(appStore.network.id, sender)

		openToast({ label: "Sender successfully deleted" })
	}

	popupStore.open("confirm")
}

const onSenderAdded = (sender) => {
	if (senders.value.includes(sender)) return

	senders.value.push(sender)
}
const onSenderDeleted = (sender) => {
	senders.value = senders.value.filter((s) => s !== sender)
}
const accountStateClientService = new AccountStateServiceClient()
accountStateClientService.onSenderAdded.add(onSenderAdded)
accountStateClientService.onSenderDeleted.add(onSenderDeleted)
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
	accountStateClientService.disconnect()
})
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="16">
			<Banner v-if="isLoading" isLoading> Fetching senders </Banner>

			<Tooltip v-else-if="error" wide>
				<Banner :action="{ name: 'Try again', callback: () => fetchSenders() }" variant="error" wide>
					Something went wrong
				</Banner>

				<template #content>
					{{ error }}
				</template>
			</Tooltip>

			<Flex v-else-if="senders.length" direction="column" gap="8">
				<Flex v-for="sender in senders" justify="between" :class="$style.card">
					<Flex gap="10">
						<Icon name="user" size="16" color="tertiary" />

						<AddressDisplay @onAddressClick="handleCopyAddress(sender)" size="14" weight="600" color="secondary" :address="sender" :formatter="(addr) => trimAddress(addr, 8, 8)" />
						<!-- <Text @click="handleCopyAddress(sender)" size="14" weight="600" color="secondary"> {{ trimAddress(sender, 8, 8) }} </Text> -->
					</Flex>

					<Flex align="center" gap="8">
						<Tooltip position="end" delay="350">
							<Icon
								v-if="!isCopied"
								@click.stop="handleCopyAddress(sender)"
								name="copy"
								size="14"
								color="tertiary"
								:class="$style.icon_btn"
							/>
							<Icon
								v-else
								name="check-circle"
								size="14"
								color="green"
								:style="{ transition: 'all 0.2s ease' }"
							/>

							<template #content> Copy address </template>
						</Tooltip>
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
					</Flex>
				</Flex>
			</Flex>

			<Banner v-else> To receive private transactions, add the sender account to your list </Banner>

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

.card {
	border-radius: 12px;
	/* cursor: pointer; */
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-10);
		span {
			color: var(--txt-primary);
			cursor: copy;
		}
	}
}

.icon_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
