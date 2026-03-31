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
		return balanceFormatted(new BN((transfer.value.amount || 0)).dividedBy(decimals), 8).value
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

	return getTransactionExplorerUrl(
		appStore.network.chainId,
		appStore.defaultExplorer,
		props.tx.hash
	)
})
</script>

<template>
	<Flex align="start" justify="between" gap="10" :class="$style.wrapper">
		<Flex align="start" gap="12" :class="$style.left_content">
			<Flex align="center" justify="center" :class="$style.activity_icon">
				<Icon :name="icon" size="16" color="primary" />

				<Icon :name="statusIcon" size="14" :color="statusColor" :class="$style.check_icon" />
			</Flex>

			<Flex direction="column" gap="4">
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="primary">
						{{ title }}
					</Text>
					<a
						v-if="explorerUrl"
						:href="explorerUrl"
						target="_blank"
						rel="noopener noreferrer"
						@click.stop="handleExternalLink($event, explorerUrl)"
						:class="$style.explorer_link"
					>
						<Icon name="external-link" size="12" color="tertiary" />
					</a>
				</Flex>
				<Text size="12" weight="500" :color="isSubtitleHash ? 'tertiary' : 'secondary'" :style="{ lineHeight: '1.4', wordBreak: isSubtitleHash ? 'break-all' : undefined }">{{ subtitle }}</Text>
			</Flex>
		</Flex>

		<Flex align="center" gap="8" :style="{ flexShrink: 0 }">
			<Flex v-if="type === 'transfer' && token" align="center" :class="$style.amount_badge">
				<Text size="12" weight="600" color="primary">
					{{ transferAmount }}
					<Text color="tertiary">&nbsp;{{ token?.symbol }}</Text>
				</Text>
			</Flex>
			<Flex v-if="type === 'mint'" align="center" :class="$style.amount_badge">
				<Text size="12" weight="600" color="primary">
					{{ mintAmount }}
				</Text>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	cursor: pointer;
	border-radius: 8px;

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.left_content {
	min-width: 0;
}

.activity_icon {
	position: relative;
	flex-shrink: 0;

	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: linear-gradient(var(--gray-8), var(--gray-3));
}

.check_icon {
	position: absolute;
	top: -8px;
	right: -8px;

	box-sizing: content-box;
	border: 3px solid var(--card-bg);
	border-radius: 50%;
}

.amount_badge {
	background: var(--gray-5);
	border-radius: 6px;

	padding: 4px 6px;
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
