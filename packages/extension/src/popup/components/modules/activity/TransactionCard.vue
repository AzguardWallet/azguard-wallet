<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Services */
import { OriginType, TxStatus, TxExecutionResult } from "@/wallet/services/transaction/client"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { getTransactionExplorerUrl } from "@/wallet/constants/explorers"
import { getTxCategory, getTxTitle, getCallCountLabel, getOriginLabel, getPrimaryCall, formatTransferType } from "@/utils/tx-enrichment"

/** Composables */
const { handleExternalLink } = useExternalLink()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const props = defineProps({
	tx: {
		type: Object,
	},
})

const call = computed(() => getPrimaryCall(props.tx.calls))
const type = computed(() => getTxCategory(props.tx.calls))
const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const token = computed(() => transfer.value?.token)
const transferAmount = computed(() => {
	if (transfer.value) {
		const decimals = new BN(10).pow(token.value?.decimals || 0)
		return balanceFormatted(new BN(transfer.value.amount || 0).dividedBy(decimals), 8).value
	}

	return 0
})

const mintAmount = computed(() => {
	if (type.value !== "mint") return 0

	const decimals = new BN(10).pow(props.tx?.origin?.type === OriginType.UI ? 8 : 0)
	let amount = new BN(0)
	for (const c of props.tx.calls) {
		amount = amount.plus(new BN(c.args?.at(-1) || 0))
	}

	return balanceFormatted(amount.dividedBy(decimals), 8).value
})

const icon = computed(() => {
	if (type.value === "transfer") return "arrow-narrow-up-right"
	if (type.value === "mint") return "faucet"
	return "zap"
})

const isMined = computed(() => {
	const s = props.tx.status
	return s === TxStatus.Proposed || s === TxStatus.Checkpointed || s === TxStatus.Proven || s === TxStatus.Finalized
})
const isPending = computed(() => props.tx.status === TxStatus.Pending)
const isDropped = computed(() => props.tx.status === TxStatus.Dropped)
const isReverted = computed(() => isMined.value && !!props.tx.executionResult && props.tx.executionResult !== TxExecutionResult.Success)
const isSuccess = computed(() => isMined.value && !isReverted.value)

const statusIcon = computed(() => {
	if (isReverted.value || isDropped.value) return "close-circle"
	if (isSuccess.value) return "check-circle"
	return "clock-circle"
})

const statusColor = computed(() => {
	if (isReverted.value || isDropped.value) return "red"
	if (isSuccess.value) return "green"
	return "gray"
})

const title = computed(() => {
	// For transfers, show token symbol instead of generic "Transfer"
	if (type.value === "transfer" && token.value?.symbol) return token.value.symbol
	return getTxTitle(props.tx.calls)
})

const subtitle = computed(() => {
	// For transfers, show transfer type (amount is already in the badge on the right)
	if (type.value === "transfer" && transfer.value) {
		return formatTransferType(transfer.value.type)
	}
	const parts = []
	const origin = getOriginLabel(props.tx.origin)
	if (origin) parts.push(origin)
	const callCount = getCallCountLabel(props.tx.calls)
	if (callCount) parts.push(callCount)
	return parts.length ? parts.join(" · ") : props.tx.hash
})
const isSubtitleHash = computed(() => type.value !== "transfer" && !getOriginLabel(props.tx.origin) && !getCallCountLabel(props.tx.calls))

const explorerUrl = computed(() => {
	if (!appStore.network?.chainId) return null

	return getTransactionExplorerUrl(appStore.network.chainId, appStore.defaultExplorer, props.tx.hash)
})
</script>

<template>
	<Flex align="center" justify="between" gap="10" data-testid="tx-card" :class="$style.wrapper">
		<Flex align="center" gap="16" :class="$style.left_content">
			<Flex align="center" justify="center" :class="$style.activity_icon">
				<Icon :name="icon" size="18" color="secondary" />
				<Icon :name="statusIcon" size="12" :color="statusColor" :class="$style.check_icon" />
			</Flex>

			<Flex direction="column" gap="4">
				<Flex align="center" gap="6">
					<span :class="$style.tx_title">{{ title }}</span>
					<a
						v-if="explorerUrl"
						:href="explorerUrl"
						target="_blank"
						rel="noopener noreferrer"
						@click.stop="handleExternalLink($event, explorerUrl)"
						:class="$style.explorer_link"
					>
						<Icon name="external-link" size="10" color="tertiary" />
					</a>
				</Flex>
				<Flex align="center" gap="6">
					<span v-if="props.tx.hash" :class="$style.tx_address">{{ props.tx.hash.slice(0, 4) }}...{{ props.tx.hash.slice(-4) }}</span>
					<span v-if="type === 'transfer' && transfer" :class="$style.tx_type_chip">{{ subtitle }}</span>
					<span v-else-if="!isSubtitleHash" :class="$style.tx_subtitle">{{ subtitle }}</span>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" align="end" gap="2" :style="{ flexShrink: 0 }">
			<span v-if="type === 'transfer' && token" :class="$style.tx_amount">{{ transferAmount }}</span>
			<span v-if="type === 'mint'" :class="$style.tx_amount">{{ mintAmount }}</span>
			<span v-if="type === 'transfer' && token" :class="$style.tx_amount_symbol">{{ token?.symbol }}</span>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	cursor: pointer;

	padding: 8px 0;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: rgba(29, 27, 26, 0.5);
	}
}

.left_content {
	min-width: 0;
}

.activity_icon {
	position: relative;
	flex-shrink: 0;

	width: 40px;
	height: 40px;

	background: var(--nulo-surface-low);
	border: 1px solid rgba(74, 70, 63, 0.3);
}

.check_icon {
	position: absolute;
	top: -6px;
	right: -6px;

	box-sizing: content-box;
	border: 2px solid var(--app-bg);
	border-radius: 50%;
}

.tx_title {
	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
}

.tx_address {
	font-family: var(--font-mono);
	font-size: 9px;
	text-transform: uppercase;
	color: var(--nulo-outline);
}

.tx_type_chip {
	font-family: var(--font-mono);
	font-size: 8px;
	text-transform: uppercase;
	color: var(--nulo-secondary);
	background: var(--nulo-surface-low);
	border: 1px solid rgba(74, 70, 63, 0.2);
	padding: 1px 4px;
}

.tx_subtitle {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-secondary);
}

.tx_amount {
	font-family: var(--font-mono);
	font-size: 14px;
	font-weight: 500;
	color: var(--txt-primary);
}

.tx_amount_symbol {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-outline);
}

.explorer_link {
	display: flex;
	align-items: center;
	text-decoration: none;

	transition: opacity 0.2s var(--bezier);

	&:hover {
		opacity: 0.7;
	}
}
</style>
