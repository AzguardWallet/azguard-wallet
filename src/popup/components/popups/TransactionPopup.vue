<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"
import { OriginType, TxExecutionResult, TxStatus } from "@/wallet/services/transaction/client"
import { AzguardFeePaymentMethod } from "@/wallet/services/account/contracts"

/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { trimAddress } from "@/utils/string"

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

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.tx?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const tokenService = new TokenServiceClient()
const configService = new ConfigServiceClient()
const isDebugMode = ref(false)

const tx = computed(() => appStore.transactions.find(t => t.hash === cacheStore.activeTxHash))
const isSuccess = computed(() => tx.value.executionResult === TxExecutionResult.Success)
const statusIcon = computed(() => {
	if (tx.value.status === TxStatus.Pending || tx.value.status === TxStatus.Cancelling) return "clock-circle"
	return "zap-circle"
})
const statusColor = computed(() => {
	if ([TxStatus.Pending, TxStatus.Cancelling, TxStatus.Cancelled].includes(tx.value.status)) return "gray"
	if (isSuccess.value) return "green"
	return "red"
})
const statusText = computed(() => {
	if (tx.value.status === TxStatus.Pending) return "Pending"
	if (tx.value.status === TxStatus.Cancelling) return "Cancelling"
	if (tx.value.status === TxStatus.Cancelled) return "Cancelled"
	if (isSuccess.value) return "Success"
	return "Failed"
})
const txTime = computed(() => {
	if (!tx.value?.updatedAt) return null
	return DateTime.fromMillis(tx.value.updatedAt).toFormat("MMM dd, yyyy 'at' HH:mm")
})

const call = computed(() => tx.value.calls.at(1)?.method?.startsWith("mint") ? tx.value.calls[1] : tx.value.calls[0])
const type = computed(() => {
	if (call.value?.method?.startsWith("transfer")) return "transfer"
	if (call.value?.method?.startsWith("mint_to_")) return "mint"
	return "tx"
})
const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const tokens = ref([])
const token = computed(() => tokens.value.find(t => call.value?.contract === t.contract))
const transferAmount = computed(() => {
	if (transfer.value) {
		const decimals = new BN(10).pow(token.value?.decimals || 0)
		return balanceFormatted(new BN((transfer.value.amount || 0)).dividedBy(decimals), 8).value
	}
	
	return 0
})
const mintAmount = computed(() => {
	if (type.value !== "mint") return 0
	
	const decimals = new BN(10).pow(tx.value?.origin?.type === OriginType.UI ? 8 : 0)
	let amount = new BN(0)
	for (const c of tx.value.calls) {
		amount = amount.plus(new BN(c.args?.at(-1) || 0))
	}

	return balanceFormatted(amount.dividedBy(decimals), 8).value
})

const formatTimestamp = (timestamp) => {
	if (!timestamp) return "N/A"
	return DateTime.fromMillis(timestamp).toFormat("yyyy-MM-dd HH:mm:ss")
}

const getFeePaymentMethodName = (method) => {
	switch (method) {
		case AzguardFeePaymentMethod.External: return "External (FPC)"
		case AzguardFeePaymentMethod.FeeJuice: return "FeeJuice"
		case AzguardFeePaymentMethod.FeeJuiceWithClaim: return "FeeJuice + Claim"
		default: return `Unknown (${method})`
	}
}

const formatFee = (fee) => {
	if (!fee) return "N/A"
	const feeBN = new BN(fee)
	return feeBN.dividedBy(new BN(10).pow(18)).toFixed(6) + " FJ"
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
	() => props.show,
	async () => {
		if (props.show) {
			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
			isDebugMode.value = await configService.getValue("debugMode")
		} else {
			tokenService.disconnect()
			configService.disconnect()
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.tx?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" align="center" gap="32" :class="$style.wrapper">
				<Flex direction="column" align="center" gap="12">
					<Tooltip>
						<Flex align="center" gap="6">
							<Icon :name="statusIcon" size="16" :color="statusColor" />
							<Text size="16" weight="600" color="primary" style="transform: translate3d(0, 0, 0, 0)">
								Transaction
							</Text>
						</Flex>

						<template #content>
							<Flex align="center" gap="4">
								<Text size="12" color="secondary">Tx status:</Text>
								<Text size="12" :color="statusColor"> {{ statusText }} </Text>
							</Flex>
						</template>
					</Tooltip>

					<Flex direction="column" align="center" gap="4">
						<Flex @click="handleCopy(tx.hash)" align="center" gap="6" class="copyable">
							<Text size="12" weight="600" color="tertiary">
								{{ tx.hash.slice(0, 4) }}
								<Text color="dark">•••</Text>
								{{ tx.hash.slice(-4) }}
							</Text>
							<Icon
								:name="isCopied ? 'check-circle' : 'copy'"
								size="12"
								:color="isCopied ? 'green' : 'tertiary'"
							/>
						</Flex>
						<Text v-if="txTime" size="12" weight="500" color="tertiary">
							{{ txTime }}
						</Text>
					</Flex>
				</Flex>

				<Flex v-if="transferAmount" align="center" direction="column" gap="8">
					<Text size="24" weight="500" color="primary">
						{{ transferAmount }}
						<Text color="tertiary">{{ transfer.token.symbol }}</Text>
					</Text>
					<Text size="12" weight="500" color="tertiary"> Transfer Amount </Text>
				</Flex>

				<Flex v-else-if="mintAmount" align="center" direction="column" gap="8">
					<Text size="24" weight="500" color="primary">
						{{ mintAmount }}
						<Text v-if="token" color="tertiary">{{ token.symbol }}</Text>
					</Text>
					<Text size="12" weight="500" color="tertiary"> Mint Amount </Text>
				</Flex>

				<Banner
					v-if="transfer && !token"
					variant="warning"
					direction="vertical"
					:action="{ name: 'Copy token address', callback: () => handleCopy(call.contract) }"
					wide
				>
					<template #title> {{ transfer.token.symbol }} is missing </template>
					<template #description> This token not found in your token list </template>
				</Banner>

				<Flex v-if="transfer" wide gap="4">
					<Flex wide align="center" gap="12" :class="[$style.item, $style.left]">
						<Flex @click="handleCopy(transfer.from)" wide direction="column" gap="4" class="copyable">
							<AddressDisplay @onAddressClick="handleCopy(transfer.from)" size="13" weight="600" :address="transfer.from" :formatter="(addr) => trimAddress(addr, 6, 4)" />
							<Text size="12" weight="500" color="tertiary"> From </Text>
						</Flex>

						<Icon
							:name="['transfer', 'transfer_to_public'].includes(call?.method) ? 'key-square' : 'face'"
							size="16"
							:color="['transfer', 'transfer_to_public'].includes(call?.method) ? 'green' : 'orange'"
						/>
					</Flex>

					<Flex wide align="center" gap="12" :class="[$style.item, $style.right]">
						<Flex @click="handleCopy(transfer.to)" wide direction="column" gap="4" class="copyable">
							<AddressDisplay @onAddressClick="handleCopy(transfer.to)" size="13" weight="600" :address="transfer.to" :formatter="(addr) => trimAddress(addr, 6, 4)" />
							<Text size="12" weight="500" color="tertiary"> Destination </Text>
						</Flex>

						<Icon
							:name="['transfer', 'transfer_to_private'].includes(call?.method) ? 'key-square' : 'face'"
							size="16"
							:color="['transfer', 'transfer_to_private'].includes(call?.method) ? 'green' : 'orange'"
						/>
					</Flex>
				</Flex>

				<Flex v-if="isDebugMode" wide direction="column" gap="8" :class="$style.debug_section">
					<Text size="11" weight="600" color="secondary" style="text-transform: uppercase; letter-spacing: 0.5px;">
						Tx Debug Details
					</Text>

					<!-- Origin -->
					<Flex wide direction="column" gap="2">
						<Text size="10" weight="600" color="tertiary">Origin</Text>
						<Text size="10" weight="500" color="primary">
							{{ tx.origin?.type === OriginType.UI ? 'UI' : tx.origin?.type === OriginType.DAPP ? 'DApp' : 'Indexer' }}
							<Text color="tertiary" v-if="tx.origin?.name">({{ tx.origin?.name }})</Text>
						</Text>
					</Flex>

					<!-- Fee Payment Method -->
					<Flex wide direction="column" gap="2">
						<Text size="10" weight="600" color="tertiary">Fee Payment</Text>
						<Text size="10" weight="500" color="primary">{{ getFeePaymentMethodName(tx.feePaymentMethod) }}</Text>
					</Flex>

					<!-- Nonce -->
					<Flex wide direction="column" gap="2">
						<Text size="10" weight="600" color="tertiary">Nonce</Text>
						<Text size="10" weight="500" color="primary" @click="handleCopy(tx.nonce)" class="copyable">
							{{ trimAddress(tx.nonce, 6, 4) }}
						</Text>
					</Flex>

					<!-- Calls -->
					<Flex wide direction="column" gap="4">
						<Text size="10" weight="600" color="tertiary">Calls ({{ tx.calls?.length || 0 }})</Text>
						<Flex wide direction="column" gap="2" :class="$style.calls_list">
							<Flex
								v-for="(call, idx) in tx.calls"
								:key="idx"
								wide
								direction="column"
								gap="1"
								:class="$style.call_item"
							>
								<Flex wide justify="between" align="center">
									<Flex align="center" gap="4">
										<Text v-if="call.isBatch" size="10" weight="500" color="tertiary" title="Re-entry call">↩</Text>
										<Text size="10" weight="600" color="primary">{{ call.method }}</Text>
									</Flex>
									<Text v-if="'callIndex' in call" size="9" weight="500" color="tertiary">#{{ call.callIndex }}</Text>
								</Flex>
								<Text size="10" weight="500" color="tertiary" @click="handleCopy(call.contract)" class="copyable">
									address: {{ trimAddress(call.contract, 6, 4) }}
								</Text>
								<Text v-if="call.chunkNonce" size="10" weight="500" color="tertiary" @click="handleCopy(call.chunkNonce)" class="copyable">
									nonce: {{ trimAddress(call.chunkNonce, 6, 4) }}
								</Text>
							</Flex>
						</Flex>
					</Flex>

					<!-- Timestamps -->
					<Flex wide direction="column" gap="2">
						<Text size="10" weight="600" color="tertiary">Created</Text>
						<Text size="10" weight="500" color="primary">{{ formatTimestamp(tx.createdAt) }}</Text>
					</Flex>

					<Flex wide direction="column" gap="2">
						<Text size="10" weight="600" color="tertiary">Updated</Text>
						<Text size="10" weight="500" color="primary">{{ formatTimestamp(tx.updatedAt) }}</Text>
					</Flex>

					<!-- Block -->
					<Flex v-if="tx.block" wide direction="column" gap="2">
						<Text size="10" weight="600" color="tertiary">Block</Text>
						<Text size="10" weight="500" color="primary">
							#{{ tx.block.number }}
							<Text color="tertiary" @click="handleCopy(tx.block.hash)" class="copyable">
								({{ trimAddress(tx.block.hash, 6, 4) }})
							</Text>
						</Text>
					</Flex>

					<!-- Fee -->
					<Flex v-if="tx.fee" wide direction="column" gap="2">
						<Text size="10" weight="600" color="tertiary">Fee Paid</Text>
						<Text size="10" weight="500" color="primary">{{ formatFee(tx.fee) }}</Text>
					</Flex>

					<!-- Error -->
					<Flex v-if="tx.error" wide direction="column" gap="2">
						<Text size="10" weight="600" color="red">Error</Text>
						<Text size="10" weight="500" color="red" :class="$style.error_text">{{ tx.error }}</Text>
					</Flex>
				</Flex>

				<Button @click="emit('onClose')" wide type="secondary" size="small"> Close </Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.item {
	background: var(--gray-5);

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&.left {
		border-radius: 8px 4px 4px 8px;
	}

	&.right {
		border-radius: 4px 8px 8px 4px;
	}
}

.debug_section {
	background: var(--gray-3);
	border-radius: 8px;
	padding: 12px;
	max-height: 400px;
	overflow-y: auto;
}

.calls_list {
	max-height: 150px;
	overflow-y: auto;
}

.call_item {
	padding: 4px 6px;
	background: var(--gray-3);
	border-radius: 4px;
}

.error_text {
	word-break: break-word;
	padding: 6px;
	background: rgba(255, 0, 0, 0.05);
	border-radius: 4px;
	border: 1px solid rgba(255, 0, 0, 0.2);
}
</style>
