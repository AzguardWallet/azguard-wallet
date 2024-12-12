<script setup>
/** Vendor */
import BN from "bignumber.js"

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
import { getNetworkColor, getNetworkType } from "@/components/ui/utils.js"

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

const route = useRoute()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
	displace: Number,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.send
})

const activeToken = computed(() =>
	// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
	appStore.tokens.find(t => t.id == cacheStore.activeTokenIdx),
)
const isBlockedTranfer = computed(
	() => !activeToken.value?.hasPrivateTransfers && !activeToken.value?.hasPublicTransfers,
)
const tokenBalance = computed(() => {
	return appStore.balances.find(
		// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
		b => b?.token.id == cacheStore.activeTokenIdx,
	)
})
const tokenBalanceByType = computed(() => {
	if (!tokenBalance.value) return 0
	return selectedSendType.value === "private"
		? tokenBalance.value.privateBalance / 10 ** activeToken.value.decimals
		: tokenBalance.value.publicBalance / 10 ** activeToken.value.decimals
})

const selectedSendType = ref("private")
const selectedReceiverType = ref("private")
const initSendType = () => {
	if (!activeToken.value) return
	if (activeToken.value.hasPrivateTransfers && activeToken.value.hasPublicTransfers) {
		selectedSendType.value = cacheStore.preselectedBalanceType
	}

	if (!activeToken.value.hasPrivateTransfers) {
		selectedSendType.value = "public"
	}

	if (!activeToken.value.hasPublicTransfers) {
		selectedSendType.value = "private"
	}
}
const initReceiverType = () => {
	if (!activeToken.value) return
	if (activeToken.value.hasPrivateBalances && activeToken.value.hasPublicBalances) {
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
	appStore.accounts.findLast(a => a.address === destinationAddressTerm.value),
)

const isAllowedToSend = computed(() => {
	if (!amountTerm.value) return

	const amountToSend = new BN(
		typeof amountTerm.value === "string" ? amountTerm.value?.replace(",", "") : amountTerm.value,
	)

	if (!tokenBalanceByType.value) return
	if (isBlockedTranfer.value) return
	if (Number.isNaN(amountToSend)) return
	if (amountToSend < 0.00000001) return
	if (!amountToSend) return
	if (!destinationAddressTerm.value.length || destinationAddressTerm.value.length !== 66) return
	if (!destinationAddressTerm.value.startsWith("0x")) return
	if (amountToSend > tokenBalanceByType.value) return

	return true
})

const handleSend = async () => {
	if (!isAllowedToSend.value) return

	const amountToSend = new BN(amountTerm.value?.trim().replace(",", "")).times(10 ** activeToken.value.decimals)

	let type

	if (selectedSendType.value === "private" && selectedReceiverType.value === "private") {
		type = TransferType.Private
	}
	if (selectedSendType.value === "private" && selectedReceiverType.value === "public") {
		type = TransferType.PrivateToPublic
	}
	if (selectedSendType.value === "public" && selectedReceiverType.value === "private") {
		type = TransferType.PublicToPrivate
	}
	if (selectedSendType.value === "public" && selectedReceiverType.value === "public") {
		type = TransferType.Public
	}

	appStore.isAwaitingTransaction = true
	managers.execution.executeTransfer(
		appStore.network.id,
		appStore.account.address,
		activeToken.value.id,
		type,
		destinationAddressTerm.value,
		amountToSend,
	)

	openToast({ label: "Transaction is sent" })

	emit("onClose")
}

watch(
	() => cacheStore.activeTokenIdx,
	() => {
		initSendType()
		initReceiverType()

		amountTerm.value = null
	},
)

watch(
	() => props.show,
	() => {
		if (props.show) {
			initSendType()
			initReceiverType()

			if (route.params.id) {
				cacheStore.activeTokenIdx = route.params.id
			}

			if (!cacheStore.activeTokenIdx && appStore.tokens.length) {
				cacheStore.activeTokenIdx = appStore.tokens[0]?.id
			}
		} else {
			amountTerm.value = null
			destinationAddressTerm.value = ""

			cacheStore.preselectedBalanceType = "private"
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.send">
		<PopupCard large :displaceIdx>
			<Flex wide direction="column" justify="between" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="16" :class="$style.top">
					<Flex align="center" gap="6">
						<Flex align="center" justify="center" :class="$style.send_icon">
							<Icon name="arrow-top-right-circle" size="16" color="primary" />

							<Icon
								name="globe"
								size="12"
								:color="getNetworkColor(appStore.network?.chainId)"
								:class="$style.warning_icon"
							/>
						</Flex>
						<Text size="16" weight="600" color="primary" style="transform: translate3d(0, 0, 0, 0)">
							Send
						</Text>

						<Text size="16" weight="600" color="tertiary">
							in {{ getNetworkType(appStore.network.chainId) }}
						</Text>
					</Flex>

					<Flex wide direction="column" gap="16">
						<Flex direction="column" gap="8">
							<SelectTokenCard :token="activeToken" />

							<SendTypesCard
								v-if="!isBlockedTranfer"
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
							:label="`${capitalize(selectedReceiverType)} destination`"
							placeholder="0xABCD"
							wide
						>
							<template #suffix>
								<Icon v-if="isAllowedToSend" name="check-circle" size="14" color="green" />
							</template>
							<template #right>
								<Flex v-if="selfAccountDestination" align="center" gap="6">
									<Icon name="vault" size="12" color="blue" />
									<Text size="13" weight="600" color="primary" noWrap>
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

.send_icon {
	position: relative;
}

.warning_icon {
	position: absolute;
	top: -6px;
	right: -6px;

	border-radius: 4px;
	background: var(--card-bg);
}
</style>
