<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import SendTypesCard from "../modules/send/SendTypesCard.vue"
import AmountCard from "../modules/send/AmountCard.vue"
import FeeJuiceCard from "../modules/send/FeeJuiceCard.vue"
import SelectTokenCard from "../modules/send/SelectTokenCard.vue"

/** Utils */
import { managers } from "@/utils/core.js"
import { capitalize } from "@/utils/string"
import { TransferType } from "@/wallet/services/transaction/client"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.popups.send
})

const activeToken = computed(() =>
	// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
	appStore.tokens.find((t) => t.id == cacheStore.activeTokenIdx)
)
const tokenBalance = computed(() => {
	return appStore.balances.find(
		// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
		(b) => b.token.id == cacheStore.activeTokenIdx
	)
})
const tokenBalanceByType = computed(() => {
	if (!tokenBalance.value) return 0
	return selectedSendType.value === "private"
		? tokenBalance.value.privateBalance / 10 ** activeToken.value.decimals
		: tokenBalance.value.publicBalance / 10 ** activeToken.value.decimals
})

const selectedSendType = ref()
const selectedReceiverType = ref("private")
const initSendType = () => {
	if (
		activeToken.value.hasPrivateTransfers &&
		activeToken.value.hasPublicTransfers
	) {
		selectedSendType.value = "private"
	}

	if (!activeToken.value.hasPrivateTransfers) {
		selectedSendType.value = "public"
	}

	if (!activeToken.value.hasPublicTransfers) {
		selectedSendType.value = "private"
	}
}
const initReceiverType = () => {
	if (
		activeToken.value.hasPrivateBalances &&
		activeToken.value.hasPublicBalances
	) {
		selectedReceiverType.value = "private"
	}

	if (!activeToken.value.hasPrivateTransfers) {
		selectedReceiverType.value = "public"
	}

	if (!activeToken.value.hasPublicTransfers) {
		selectedReceiverType.value = "private"
	}
}

const amountTerm = ref()

const destinationAddressTerm = ref("")
const selfAccountDestination = computed(() =>
	appStore.accounts.findLast(
		(a) => a.address === destinationAddressTerm.value
	)
)

const isAllowedToSend = computed(() => {
	const amountToSend = Number.parseFloat(amountTerm.value?.replace(",", ""))

	if (!tokenBalanceByType.value) return
	if (Number.isNaN(amountToSend)) return
	if (amountToSend < 0.01) return
	if (
		!destinationAddressTerm.value.length ||
		destinationAddressTerm.value.length !== 66
	)
		return
	if (!destinationAddressTerm.value.startsWith("0x")) return

	return true
})

const isSending = ref(false)
const handleSend = async () => {
	if (!isAllowedToSend.value) return

	const amountToSend =
		Number.parseFloat(amountTerm.value?.trim().replace(",", "")) *
		10 ** activeToken.value.decimals

	let test

	if (
		selectedSendType.value === "private" &&
		selectedReceiverType.value === "private"
	) {
		test = TransferType.Private
	}
	if (
		selectedSendType.value === "private" &&
		selectedReceiverType.value === "public"
	) {
		test = TransferType.PrivateToPublic
	}
	if (
		selectedSendType.value === "public" &&
		selectedReceiverType.value === "private"
	) {
		test = TransferType.PublicToPrivate
	}
	if (
		selectedSendType.value === "public" &&
		selectedReceiverType.value === "public"
	) {
		test = TransferType.Public
	}

	isSending.value = true
	const txHash = await managers.execution.executeTransfer(
		appStore.network.id,
		appStore.account.address,
		activeToken.value.id,
		test,
		destinationAddressTerm.value,
		amountToSend
	)
	isSending.value = false

	console.log(txHash)
	openToast({ label: "Transaction is sent" })

	emit("onClose")
}

watch(
	() => cacheStore.activeTokenIdx,
	() => {
		initSendType()
		initReceiverType()
	}
)

watch(
	() => props.show,
	() => {
		if (props.show) {
			initSendType()
			initReceiverType()
		}
	}
)

watch(
	() => cacheStore.activeTokenIdx,
	() => {
		amountTerm.value = null
	}
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')">
		<PopupCard large :displaceIdx="displaceIdx">
			<Flex
				wide
				direction="column"
				justify="between"
				:class="$style.wrapper"
			>
				<Flex
					align="center"
					direction="column"
					gap="16"
					:class="$style.top"
				>
					<Flex align="center" gap="6">
						<Icon
							name="arrow-top-right-circle"
							size="16"
							color="primary"
						/>
						<Text size="16" weight="600" color="primary">
							Send
						</Text>
					</Flex>

					<Flex wide direction="column" gap="16">
						<Flex direction="column" gap="8">
							<SelectTokenCard />

							<SendTypesCard
								v-model:sendType="selectedSendType"
								v-model:receiverType="selectedReceiverType"
								:token="activeToken"
							/>

							<AmountCard
								v-model="amountTerm"
								:selectedSendType
								:token="activeToken"
								:tokenBalanceByType
							/>
						</Flex>

						<Input
							v-model="destinationAddressTerm"
							:label="`${capitalize(
								selectedReceiverType
							)} destination`"
							placeholder="0xABCD"
							wide
						>
							<template #suffix>
								<Icon
									v-if="isAllowedToSend"
									name="check-circle"
									size="14"
									color="green"
								/>
							</template>
							<template #right>
								<Flex
									v-if="selfAccountDestination"
									align="center"
									gap="6"
								>
									<Icon name="vault" size="12" color="blue" />
									<Text
										size="13"
										weight="600"
										color="primary"
										noWrap
									>
										{{ selfAccountDestination.name }}
									</Text>
								</Flex>
							</template>
						</Input>
						<FeeJuiceCard />
					</Flex>
				</Flex>

				<Flex direction="column" gap="12" :class="$style.bottom">
					<Button
						@click="handleSend"
						wide
						type="primary"
						size="medium"
						rightIcon="arrow-right-circle"
						rightIconColor="inverse"
						:disabled="!isAllowedToSend"
						:loading="isSending"
					>
						<Text color="inverse">Send</Text>
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;
}

.top {
	padding: 0 20px;
}

.selector {
	border-radius: 10px;
	background: var(--gray-10);

	padding: 2px;
}

.bottom {
	padding: 20px;
}
</style>
