<script setup>
/** Vendor */
import { DateTime } from "luxon"

/** Services */
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { TxExecutionResult, TxStatus } from "@/wallet/services/transaction/spec"

/** Components */
import FeeSettingsCard from "@/popup/components/modules/send/FeeSettingsCard.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
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
const isLoading = ref(false)

const executionService = new ExecutionServiceClient()
const transactionService = new TransactionServiceClient()
transactionService.onTransactionUpdated.add(onTransactionUpdated)
function onTransactionUpdated(tx) {
	if (cancellingTx.value.hash !== tx.hash) return

	cancellingTx.value = tx

	if (tx.status !== TxStatus.Pending && tx.status !== TxStatus.Cancelling) {
		openToast({ label: "Cancelling tx is no longer pending", icon: "info" })
		isLoading.value = false
		executionService.disconnect()
		transactionService.disconnect()
		cancellingTx.value = null
		emit("onClose")
		return
	}
}

const isCancellingTxSuccess = computed(() => cancellingTx.value?.executionResult === TxExecutionResult.Success)
const statusColor = computed(() => {
	if ([TxStatus.Pending, TxStatus.Cancelling, TxStatus.Cancelled].includes(cancellingTx.value?.status)) return "gray"
	if (isCancellingTxSuccess.value) return "green"
	return "red"
})
const statusText = computed(() => {
	if (cancellingTx.value?.status === TxStatus.Pending) return "Pending"
	if (cancellingTx.value?.status === TxStatus.Cancelling) return "Cancelling"
	if (isCancellingTxSuccess.value) return "Success"
	return "Failed"
})

const isAllowedToCancelTx = computed(() => {
	if (!cancellingTx.value) return
	if (!feeSettings.value) return
	if (cancellingTx.value.status !== TxStatus.Pending) return

	return true
})

async function handleCancelTx() {
	if (!isAllowedToCancelTx.value) return

	try {
		isLoading.value = true

		await executionService.cancelTx(
			cancellingTx.value,
			appStore.network.id,
			feeSettings.value,
		)
	} catch (err) {
		openToast({ label: "Failed to cancel Tx", icon: "warning" }, 2_000)
	} finally {
		isLoading.value = false
		executionService.disconnect()
		transactionService.disconnect()
		cancellingTx.value = null
		emit("onClose")
	}
}

const showJson = () => {
	cacheStore.viewerData = cancellingTx.value
	popupStore.open("data_viewer")
}

const isCopied = ref(false)
const handleCopy = (target) => {
	isCopied.value = true

	window.navigator.clipboard.writeText(target)
	openToast({ label: "Successfully copied", icon: "copy" }, 2_000)

	setTimeout(() => {
		isCopied.value = false
	}, 1_500)
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

			if (!isLoading.value) {
				executionService.disconnect()
				transactionService.disconnect()
				cancellingTx.value = null
			}
		} else {
			document.addEventListener("keydown", onKeydown)

			if (!cancellingTx.value) {
				cancellingTx.value = await transactionService.getTransaction(cacheStore.activeTxHash)
				if (cancellingTx.value?.status === TxStatus.Cancelling) {
					isLoading.value = true
				}
			}
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
				<Flex direction="column" gap="8" :class="$style.transaction" >
					<Flex justify="between" wide>
						<Text size="13" weight="600" color="secondary">Cancelling transaction</Text>
						<Tooltip position="end">
							<Icon @click="showJson" name="brackets" size="16" color="tertiary" hoverColor="secondary" style="cursor: pointer;" />

							<template #content>
								<Text size="12" color="secondary"> View raw tx </Text>
							</template>
						</Tooltip>
					</Flex>

					<Flex wide :class="$style.divider" />

					<Flex justify="between" wide>
						<Text size="12" color="secondary">Status:</Text>
						<Text size="12" weight="600" :color="statusColor">{{ statusText }}</Text>
					</Flex>
					<Flex justify="between" wide>
						<Text size="12" color="secondary">Hash:</Text>
						<Flex @click="handleCopy(cancellingTx?.hash)" align="center" gap="6" class="copyable">
							<Text size="12" weight="600" color="tertiary">
								{{ cancellingTx?.hash?.slice(0, 6) }}
								<Text color="dark">•••</Text>
								{{ cancellingTx?.hash?.slice(-6) }}
							</Text>
							<Icon
								:name="isCopied ? 'check-circle' : 'copy'"
								size="12"
								:color="isCopied ? 'green' : 'tertiary'"
							/>
						</Flex>
					</Flex>
					<Flex justify="between" wide>
						<Text size="12" color="secondary">Created at:</Text>
						<Text v-if="cancellingTx?.createdAt"size="12" weight="500" color="tertiary">
							{{ DateTime.fromMillis(cancellingTx.createdAt).toFormat("MMM dd, yyyy 'at' HH:mm") }}
						</Text>
					</Flex>
				</Flex>
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
							<NetworkBadge :network="appStore.network" />
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
						:disabled="!isAllowedToCancelTx"
					/>
				</Flex>
				<!-- <Banner direction="vertical">
					<template #title> The Faucet functionality is here temporarily </template>
					<template #description> It will be moved elsewhere in the future </template>
				</Banner> -->



				<!-- <FeeSettingsCard
					:profile="appStore.profile"
					:network="appStore.network"
					:account="appStore.account"
					v-model="feeSettings"
				/> -->

				<Flex align="center" direction="column" gap="12">
					<Button
						@click="handleCancelTx"
						type="primary"
						size="medium"
						wide
						:loading="isLoading"
						:disabled="!isAllowedToCancelTx || isLoading"
					>
						{{ isLoading  ? "Cancelling Transaction" : "Cancel Transaction" }}
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

.transaction {
	width: 100%;
	border-radius: 12px;
	border: 1px solid var(--gray-10);

	padding: 12px;
}

.divider {
	height: 1px;
	background: var(--gray-8);
	/* margin: 0 -20px; */
	padding: 0;
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
