<script setup>
/** Services */
import { FaucetServiceClient } from "@/wallet/services/faucet/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { TxStatus } from "@/wallet/services/transaction/spec"

/** Vendor */
import BN from "bignumber.js"

/** Components */
import FeeSettingsCard from "@/popup/components/modules/send/FeeSettingsCard.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { purgeNumber, normalizeAmount } from "@/utils/amount.js"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
import { trim } from "@/wallet/logger"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const route = useRoute()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.cancel_tx?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const feeSettings = ref()

const cancellingTx = ref()

const executionService = new ExecutionServiceClient()
const transactionService = new TransactionServiceClient()
transactionService.onTransactionUpdated.add(onTransactionUpdated)
function onTransactionUpdated(tx) {
	if (cancellingTx.value.hash !== tx.hash) return

	if (tx.status !== TxStatus.Pending) {
		openToast({ label: "Selected tx is no longer pending", icon: "info" })
		emit("onClose")
		return
	}

	cancellingTx.value = tx
}

const isAllowedToCancelTx = computed(() => {
	if (!cancellingTx.value) return
	if (!feeSettings.value) return
	if (cancellingTx.value.status !== TxStatus.Pending) return

	return true
})

function handleCancelTx() {
	if (!isAllowedToCancelTx) return

	try {
		executionService.cancelTx(
			cancellingTx.value,
			appStore.network.id,
			feeSettings.value,
		)
	} catch (err) {
		console.error(err);
		emit("onClose")
	}
}

watch(
	() => appStore.network,
	() => {
		emit("onClose")
	},
)
watch(
	() => appStore.account,
	() => {
		if (appStore.account?.address !== cancellingTx.value?.address) {
			emit("onClose")
		}
	},
)
watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			executionService.disconnect()
			transactionService.disconnect()

			cancellingTx.value = null
		} else {
			document.addEventListener("keydown", onKeydown)

			cancellingTx.value = await transactionService.getTransaction(cacheStore.activeTxHash)
			console.log('cancellingTx.value', cancellingTx.value);
			
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleCancelTx()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.cancel_tx?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Cancel Transaction</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Flex direction="column" wide>
					<Flex
						:class="$style.transaction"
						direction="column"
						wide
						style="
							margin-bottom: 0;
							border-bottom-right-radius: 0;
							border-bottom-left-radius: 0;
							border-bottom: none;
						"
					>
						<Flex wide justify="between">
							<Text size="14" color="primary"> Send transaction</Text>
							<NetworkBadge :chainId="appStore.network.chainId" />
						</Flex>
						<Flex v-if="cancellingTx?.account" :class="$style.prop">
							<Text size="12" color="secondary">From account:</Text>
							<AddressDisplay :address="cancellingTx.account" />
						</Flex>
						<!-- <Flex :class="$style.prop">
							<Text size="12" color="secondary">Payload:</Text>
							<Flex direction="column" gap="4">
								<Text
									v-for="(action, j) in op.actions"
									:key="`${i}:${j}`"
									size="12"
									color="primary"
								>
									<template v-if="action.kind === 'call' || action.kind === 'encoded_call'">
										<Text color="secondary"> call </Text>
										{{ action.kind === "call" ? action.method : action.selector }}
										<Text color="secondary"> in </Text>
										<AddressDisplay
											:address="action.kind === 'call' ? action.contract : action.to"
										/>
									</template>
									<template v-else>
										{{ action.kind.replace("_", " ") }}
									</template>
								</Text>
							</Flex>
						</Flex> -->
					</Flex>
					<FeeSettingsCard
						:profile="appStore.profile"
						:network="appStore.network"
						:account="appStore.account"
						v-model="feeSettings"
						style="border-top-left-radius: 0; border-top-right-radius: 0; opacity: 1"
					/>
				</Flex>
				<!-- <Banner direction="vertical">
					<template #title> The Faucet functionality is here temporarily </template>
					<template #description> It will be moved elsewhere in the future </template>
				</Banner> -->



				<FeeSettingsCard
					:profile="appStore.profile"
					:network="appStore.network"
					:account="appStore.account"
					v-model="feeSettings"
				/>

				<Flex align="center" direction="column" gap="12">
					<Button
						@click="handleCancelTx"
						type="primary"
						size="medium"
						wide
						:disabled="!isAllowedToCancelTx"
					>
						Cancel Transaction
					</Button>

					<!-- <Tooltip v-if="isErrorOccurred" side="top">
						<Flex align="center" gap="6">
							<Icon name="info" size="12" color="red" />
							<Text size="12" weight="500" color="secondary">
								There was an error in the minting process
							</Text>
						</Flex>

						<template #content> {{ error }} </template>
					</Tooltip> -->
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.wrapper {
	overflow: auto;
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 12px;
}

.transaction {
	width: 100%;
	border-radius: 12px;
	border: 1px solid var(--gray-10);

	padding: 12px;
}

.prop {
	width: 100%;
	justify-content: space-between;
	padding-top: 12px;

	:last-child {
		text-align: right;
	}
}
</style>
