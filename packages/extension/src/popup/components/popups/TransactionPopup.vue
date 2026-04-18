<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"
import { OriginType } from "@/wallet/services/transaction/client"
import { NuloFeePaymentMethod } from "@/wallet/services/account/contracts"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { getTxCategory, getTxTitle, getOriginLabel, getPrimaryCall } from "@/utils/tx-enrichment"
import { formatFeeJuice, feeToUsd, formatGas } from "@/utils/fee-estimation"
import { getTransactionExplorerUrl } from "@/wallet/constants/explorers"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()
const { handleExternalLink } = useExternalLink()

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

const tx = computed(() => appStore.transactions.find((t) => t.hash === cacheStore.activeTxHash))
const call = computed(() => getPrimaryCall(tx.value.calls))
const type = computed(() => getTxCategory(tx.value.calls))

const popupTitle = computed(() => getTxTitle(tx.value.calls))
const originLabel = computed(() => getOriginLabel(tx.value?.origin))

const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const tokens = ref([])
const token = computed(() => tokens.value.find((t) => call.value?.contract === t.contract))

const transferAmount = computed(() => {
	if (transfer.value) {
		const decimals = new BN(10).pow(token.value?.decimals || 0)
		return balanceFormatted(new BN(transfer.value.amount || 0).dividedBy(decimals), 8).value
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

/** Expandable sections (reset on popup close). */
const showFeeBreakdown = ref(false)
const isDebugExpanded = ref(false)

watch(
	() => props.show,
	async () => {
		if (props.show) {
			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
		} else {
			tokenService.disconnect()
			showFeeBreakdown.value = false
			isDebugExpanded.value = false
		}
	},
)

const txTime = computed(() => {
	if (!tx.value?.updatedAt) return null
	return DateTime.fromMillis(tx.value.updatedAt).toFormat("MMM dd, yyyy 'at' HH:mm")
})

const handleCopy = (target) => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Successfully copied", icon: "copy" })
}

const formatTimestamp = (timestamp) => {
	if (!timestamp) return "N/A"
	return DateTime.fromMillis(timestamp).toFormat("yyyy-MM-dd HH:mm:ss")
}

const getFeePaymentMethodName = (method) => {
	switch (method) {
		case NuloFeePaymentMethod.External:
			return "External (FPC)"
		case NuloFeePaymentMethod.FeeJuice:
			return "FeeJuice"
		case NuloFeePaymentMethod.FeeJuiceWithClaim:
			return "FeeJuice + Claim"
		default:
			return `Unknown (${method})`
	}
}

/** Fee display (actual fee from receipt) */
const formattedFee = computed(() => {
	if (!tx.value?.fee) return null
	return formatFeeJuice(BigInt(tx.value.fee))
})
const formattedFeeUsd = computed(() => {
	if (!tx.value?.fee) return null
	return feeToUsd(BigInt(tx.value.fee))
})

/** Estimated fee display (from gas settings at submission time) */
const formattedEstFee = computed(() => {
	if (!tx.value?.estimatedFee) return null
	return formatFeeJuice(BigInt(tx.value.estimatedFee))
})
const formattedEstFeeUsd = computed(() => {
	if (!tx.value?.estimatedFee) return null
	return feeToUsd(BigInt(tx.value.estimatedFee))
})

const hasGasDetails = computed(() => !!tx.value?.gasDetails)
const gasBreakdown = computed(() => {
	const gd = tx.value?.gasDetails
	if (!gd) return null

	const feePerL2 = BigInt(gd.feePerL2Gas)
	const feePerDa = BigInt(gd.feePerDaGas)

	const l2Cost = BigInt(gd.l2GasLimit) * feePerL2
	const daCost = BigInt(gd.daGasLimit) * feePerDa
	const teardownL2Cost = BigInt(gd.teardownL2GasLimit) * feePerL2
	const teardownDaCost = BigInt(gd.teardownDaGasLimit) * feePerDa

	return {
		l2Gas: formatGas(gd.l2GasLimit),
		daGas: formatGas(gd.daGasLimit),
		teardownL2Gas: formatGas(gd.teardownL2GasLimit),
		teardownDaGas: formatGas(gd.teardownDaGasLimit),
		l2Cost: formatFeeJuice(l2Cost),
		daCost: formatFeeJuice(daCost),
		teardownCost: formatFeeJuice(teardownL2Cost + teardownDaCost),
		hasTeardown: gd.teardownL2GasLimit > 0 || gd.teardownDaGasLimit > 0,
	}
})
const feeSavings = computed(() => {
	if (!tx.value?.fee || !tx.value?.estimatedFee) return null
	const actual = BigInt(tx.value.fee)
	const estimated = BigInt(tx.value.estimatedFee)
	if (estimated === 0n || actual >= estimated) return null
	const pct = Number(((estimated - actual) * 100n) / estimated)
	return `${pct}% less than estimate`
})

const explorerUrl = computed(() => {
	if (!appStore.network?.chainId || !tx.value?.hash) return null
	return getTransactionExplorerUrl(appStore.network.chainId, appStore.defaultExplorer, tx.value.hash)
})
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.tx?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<!-- Hero -->
				<Flex direction="column" align="center" gap="10">
					<Flex align="center" gap="8">
						<Icon name="zap-circle" size="16" color="primary" />
						<span :class="$style.tx_title">{{ popupTitle }}</span>
					</Flex>

					<span v-if="txTime" :class="$style.tx_time">{{ txTime }}</span>

					<Flex align="start" gap="8" wide :class="$style.hash_row">
						<span
							@click="handleCopy(tx.hash)"
							:class="[$style.hash_value, 'copyable']"
						>
							{{ tx.hash }}
						</span>
						<Flex align="center" gap="6" :style="{ flexShrink: 0, marginTop: '2px' }">
							<Icon @click="handleCopy(tx.hash)" name="copy" size="12" color="tertiary" class="copyable" />
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
					</Flex>
				</Flex>

				<!-- Amount -->
				<Flex v-if="transferAmount" align="center" direction="column" gap="6">
					<span :class="$style.amount_value">
						{{ transferAmount }}
						<span :class="$style.amount_symbol">{{ transfer.token.symbol }}</span>
					</span>
					<span :class="$style.amount_caption">Transfer amount</span>
				</Flex>

				<Flex v-else-if="mintAmount" align="center" direction="column" gap="6">
					<span :class="$style.amount_value">
						{{ mintAmount }}
						<span v-if="token" :class="$style.amount_symbol">{{ token.symbol }}</span>
					</span>
					<span :class="$style.amount_caption">Mint amount</span>
				</Flex>

				<!-- Missing-token warning -->
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

				<!-- From / To -->
				<Flex v-if="transfer" wide gap="8">
					<Flex wide align="center" gap="12" :class="$style.address_card">
						<Flex @click="handleCopy(transfer.from)" wide direction="column" gap="4" class="copyable">
							<AddressDisplay
								@onAddressClick="handleCopy(transfer.from)"
								size="13"
								weight="600"
								:address="transfer.from"
								:formatter="(addr) => trimAddress(addr, 6, 4)"
							/>
							<span :class="$style.address_label">From</span>
						</Flex>

						<Icon
							:name="['transfer', 'transfer_to_public'].includes(call?.method) ? 'key-square' : 'face'"
							size="16"
							:color="['transfer', 'transfer_to_public'].includes(call?.method) ? 'green' : 'orange'"
						/>
					</Flex>

					<Flex wide align="center" gap="12" :class="$style.address_card">
						<Flex @click="handleCopy(transfer.to)" wide direction="column" gap="4" class="copyable">
							<AddressDisplay
								@onAddressClick="handleCopy(transfer.to)"
								size="13"
								weight="600"
								:address="transfer.to"
								:formatter="(addr) => trimAddress(addr, 6, 4)"
							/>
							<span :class="$style.address_label">Destination</span>
						</Flex>

						<Icon
							:name="['transfer', 'transfer_to_private'].includes(call?.method) ? 'key-square' : 'face'"
							size="16"
							:color="['transfer', 'transfer_to_private'].includes(call?.method) ? 'green' : 'orange'"
						/>
					</Flex>
				</Flex>

				<!-- Details -->
				<Flex wide direction="column" gap="10">
					<SectionLabel label="Details" />

					<Flex wide direction="column" gap="10" :class="$style.details_box">
						<Flex v-if="originLabel" wide justify="between" align="center">
							<span :class="$style.detail_key">App</span>
							<span :class="$style.detail_value">{{ originLabel }}</span>
						</Flex>

						<Flex v-if="tx.feePaymentMethod != null" wide justify="between" align="center">
							<span :class="$style.detail_key">Fee method</span>
							<span :class="$style.detail_value">{{ getFeePaymentMethodName(tx.feePaymentMethod) }}</span>
						</Flex>

						<Flex v-if="formattedFee" wide direction="column" gap="8">
							<Flex
								wide justify="between" align="center"
								:class="hasGasDetails && $style.fee_row_toggle"
								@click="hasGasDetails && (showFeeBreakdown = !showFeeBreakdown)"
							>
								<Flex align="center" gap="4">
									<span :class="$style.detail_key">Fee paid</span>
									<Icon
										v-if="hasGasDetails"
										name="chevron"
										size="10"
										color="tertiary"
										:style="{ transform: `rotate(${showFeeBreakdown ? '180' : '0'}deg)`, transition: 'transform 0.2s ease' }"
									/>
								</Flex>
								<Flex align="center" gap="6">
									<span :class="$style.detail_value_mono">{{ formattedFee }} FJ</span>
									<span :class="$style.detail_value_aux">{{ formattedFeeUsd }}</span>
								</Flex>
							</Flex>

							<Flex v-if="showFeeBreakdown && gasBreakdown" wide direction="column" gap="6" :class="$style.fee_breakdown">
								<div :class="$style.fee_grid">
									<span :class="$style.fee_grid_key">L2 gas</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_aux]">{{ gasBreakdown.l2Gas }}</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_val]">{{ gasBreakdown.l2Cost }} FJ</span>

									<span :class="$style.fee_grid_key">DA gas</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_aux]">{{ gasBreakdown.daGas }}</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_val]">{{ gasBreakdown.daCost }} FJ</span>

									<template v-if="gasBreakdown.hasTeardown">
										<span :class="$style.fee_grid_key">Teardown</span>
										<span :class="[$style.fee_grid_num, $style.fee_grid_aux]">{{ gasBreakdown.teardownL2Gas }} + {{ gasBreakdown.teardownDaGas }}</span>
										<span :class="[$style.fee_grid_num, $style.fee_grid_val]">{{ gasBreakdown.teardownCost }} FJ</span>
									</template>
								</div>
								<Flex v-if="formattedEstFee" wide justify="between" align="center" :class="$style.fee_breakdown_divider">
									<span :class="$style.fee_grid_key">Estimated</span>
									<span :class="$style.fee_grid_val">{{ formattedEstFee }} FJ</span>
								</Flex>
								<Flex v-if="feeSavings" wide justify="end">
									<span :class="$style.fee_savings">{{ feeSavings }}</span>
								</Flex>
							</Flex>
						</Flex>

						<Flex v-else-if="formattedEstFee" wide direction="column" gap="8">
							<Flex
								wide justify="between" align="center"
								:class="hasGasDetails && $style.fee_row_toggle"
								@click="hasGasDetails && (showFeeBreakdown = !showFeeBreakdown)"
							>
								<Flex align="center" gap="4">
									<span :class="$style.detail_key">Estimated fee</span>
									<Icon
										v-if="hasGasDetails"
										name="chevron"
										size="10"
										color="tertiary"
										:style="{ transform: `rotate(${showFeeBreakdown ? '180' : '0'}deg)`, transition: 'transform 0.2s ease' }"
									/>
								</Flex>
								<Flex align="center" gap="6">
									<span :class="[$style.detail_value_mono, $style.detail_value_est]">~{{ formattedEstFee }} FJ</span>
									<span :class="$style.detail_value_aux">{{ formattedEstFeeUsd }}</span>
								</Flex>
							</Flex>

							<Flex v-if="showFeeBreakdown && gasBreakdown" wide direction="column" gap="6" :class="$style.fee_breakdown">
								<div :class="$style.fee_grid">
									<span :class="$style.fee_grid_key">L2 gas</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_aux]">{{ gasBreakdown.l2Gas }}</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_val]">{{ gasBreakdown.l2Cost }} FJ</span>

									<span :class="$style.fee_grid_key">DA gas</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_aux]">{{ gasBreakdown.daGas }}</span>
									<span :class="[$style.fee_grid_num, $style.fee_grid_val]">{{ gasBreakdown.daCost }} FJ</span>

									<template v-if="gasBreakdown.hasTeardown">
										<span :class="$style.fee_grid_key">Teardown</span>
										<span :class="[$style.fee_grid_num, $style.fee_grid_aux]">{{ gasBreakdown.teardownL2Gas }} + {{ gasBreakdown.teardownDaGas }}</span>
										<span :class="[$style.fee_grid_num, $style.fee_grid_val]">{{ gasBreakdown.teardownCost }} FJ</span>
									</template>
								</div>
							</Flex>
						</Flex>

						<Flex v-if="tx.nonce" wide justify="between" align="center">
							<span :class="$style.detail_key">Nonce</span>
							<span
								@click="handleCopy(tx.nonce)"
								:class="[$style.detail_value_mono, 'copyable']"
							>
								{{ trimAddress(tx.nonce, 6, 4) }}
							</span>
						</Flex>
					</Flex>
				</Flex>

				<!-- Debug details (collapsed by default) -->
				<Flex v-if="tx.calls?.length || tx.block || tx.error" wide direction="column" gap="10">
					<Flex
						@click="isDebugExpanded = !isDebugExpanded"
						wide justify="between" align="center"
						:class="$style.debug_header"
					>
						<SectionLabel label="Debug details" :count="tx.calls?.length ?? null" />
						<Icon
							name="chevron"
							size="12"
							color="tertiary"
							:style="{ transform: `rotate(${isDebugExpanded ? '180' : '0'}deg)`, transition: 'transform 0.2s ease' }"
						/>
					</Flex>

					<Flex v-if="isDebugExpanded" wide direction="column" gap="12" :class="$style.details_box">
						<Flex v-if="tx.calls?.length" wide direction="column" gap="6">
							<span :class="$style.detail_key">Calls</span>
							<Flex wide direction="column" gap="6">
								<Flex
									v-for="(c, idx) in tx.calls"
									:key="idx"
									wide direction="column" gap="2"
									:class="$style.call_item"
								>
									<Flex wide justify="between" align="center">
										<Flex align="center" gap="4">
											<span v-if="c.isBatch" :class="$style.detail_key" title="Re-entry call">↩</span>
											<span :class="$style.call_method">{{ c.method ?? "Unknown" }}</span>
										</Flex>
										<span v-if="'callIndex' in c" :class="$style.detail_value_aux">#{{ c.callIndex }}</span>
									</Flex>
									<span
										@click="handleCopy(c.contract)"
										:class="[$style.call_line, 'copyable']"
									>
										address: {{ trimAddress(c.contract, 6, 4) }}
									</span>
									<span
										v-if="c.chunkNonce"
										@click="handleCopy(c.chunkNonce)"
										:class="[$style.call_line, 'copyable']"
									>
										nonce: {{ trimAddress(c.chunkNonce, 6, 4) }}
									</span>
								</Flex>
							</Flex>
						</Flex>

						<Flex wide justify="between" align="center">
							<span :class="$style.detail_key">Created</span>
							<span :class="$style.detail_value_mono">{{ formatTimestamp(tx.createdAt) }}</span>
						</Flex>

						<Flex wide justify="between" align="center">
							<span :class="$style.detail_key">Updated</span>
							<span :class="$style.detail_value_mono">{{ formatTimestamp(tx.updatedAt) }}</span>
						</Flex>

						<Flex v-if="tx.block" wide justify="between" align="center">
							<span :class="$style.detail_key">Block</span>
							<Flex align="center" gap="6">
								<span :class="$style.detail_value_mono">#{{ tx.block.number }}</span>
								<span
									@click="handleCopy(tx.block.hash)"
									:class="[$style.detail_value_aux, 'copyable']"
								>
									{{ trimAddress(tx.block.hash, 6, 4) }}
								</span>
							</Flex>
						</Flex>

						<Flex v-if="tx.error" wide direction="column" gap="6">
							<span :class="$style.error_key">Error</span>
							<span :class="$style.error_text">{{ tx.error }}</span>
						</Flex>
					</Flex>
				</Flex>

				<Button @click="emit('onClose')" wide type="secondary" size="small">
					<Text size="13">Close</Text>
				</Button>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

/* ── Hero ──────────────────────────────────────────────────────── */

.tx_title {
	font-family: var(--font-headline);
	font-size: 16px;
	font-weight: 700;
	letter-spacing: 0.02em;
	color: var(--txt-primary);
	text-transform: uppercase;
}

.tx_time {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);
}

.hash_row {
	padding: 8px 10px;
	border: 1px solid var(--nulo-border);
	background: transparent;
}

.hash_value {
	flex: 1;
	min-width: 0;

	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-secondary);
	word-break: break-all;
}

.explorer_link {
	display: flex;
	align-items: center;
	text-decoration: none;
	cursor: pointer;

	& svg {
		transition: fill 0.2s var(--bezier);
	}

	&:hover svg {
		fill: var(--txt-primary);
	}
}

/* ── Amount ────────────────────────────────────────────────────── */

.amount_value {
	font-family: var(--font-mono);
	font-size: 24px;
	font-weight: 500;
	color: var(--txt-primary);
}

.amount_symbol {
	color: var(--nulo-secondary);
}

.amount_caption {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

/* ── Address cards ─────────────────────────────────────────────── */

.address_card {
	width: 100%;

	padding: 12px;
	border: 1px solid var(--nulo-border);
	background: transparent;
}

.address_label {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

/* ── Detail rows ───────────────────────────────────────────────── */

.details_box {
	padding: 12px;
	border: 1px solid var(--nulo-border);
	background: transparent;
}

.detail_key {
	font-family: var(--font-headline);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.detail_value {
	font-family: var(--font-body);
	font-size: 12px;
	font-weight: 600;
	color: var(--txt-primary);
}

.detail_value_mono {
	font-family: var(--font-mono);
	font-size: 12px;
	font-weight: 600;
	color: var(--txt-primary);
}

.detail_value_est {
	color: var(--nulo-secondary);
}

.detail_value_aux {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-outline);
}

/* ── Fee breakdown ─────────────────────────────────────────────── */

.fee_row_toggle {
	cursor: pointer;
	transition: opacity 0.2s ease;

	&:hover {
		opacity: 0.8;
	}
}

.fee_breakdown {
	padding-top: 8px;
	border-top: 1px solid var(--nulo-border);
}

.fee_grid {
	display: grid;
	grid-template-columns: auto 1fr auto;
	gap: 4px 10px;
	align-items: center;
}

.fee_grid_key {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.fee_grid_num {
	font-family: var(--font-mono);
	font-size: 11px;
	text-align: right;
}

.fee_grid_aux {
	color: var(--nulo-outline);
}

.fee_grid_val {
	color: var(--txt-primary);
	font-weight: 600;
}

.fee_breakdown_divider {
	padding-top: 6px;
	border-top: 1px solid var(--nulo-border);
}

.fee_savings {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--green);
}

/* ── Debug header + body ───────────────────────────────────────── */

.debug_header {
	cursor: pointer;
	transition: opacity 0.2s ease;

	&:hover {
		opacity: 0.8;
	}
}

.call_item {
	padding: 6px 8px;
	border-left: 1px solid var(--nulo-border);
}

.call_method {
	font-family: var(--font-mono);
	font-size: 11px;
	font-weight: 600;
	color: var(--txt-primary);
}

.call_line {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-secondary);
}

.error_key {
	font-family: var(--font-headline);
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	color: var(--red);
}

.error_text {
	padding: 8px 10px;
	border: 1px solid rgba(255, 0, 0, 0.3);
	background: transparent;

	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--red);
	word-break: break-word;
}
</style>
