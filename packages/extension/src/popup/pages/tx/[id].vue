<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import SubPageHeader from "@/components/ui/SubPageHeader.vue"

/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"
import { OriginType } from "@/wallet/services/transaction/client"
import { NuloFeePaymentMethod } from "@/wallet/services/account/contracts"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { trimAddress } from "@/utils/string"
import { getTxCategory, getTxTitle, getOriginLabel, getPrimaryCall, formatTransferType, humanizeMethodName } from "@/utils/tx-enrichment"
import { formatFeeJuice, feeToUsd, formatGas } from "@/utils/fee-estimation"
import { getTransactionExplorerUrl, BLOCK_EXPLORERS } from "@/wallet/constants/explorers"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()
const { handleExternalLink } = useExternalLink()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const route = useRoute()
const router = useRouter()

const tokenService = new TokenServiceClient()

const FEE_METHODS = new Set(["sponsor_unconditionally", "fee_entrypoint_private", "fee_entrypoint_public", "set_authorized"])

const tx = computed(() => appStore.transactions.find((t) => t.hash === route.params.id))
const call = computed(() => (tx.value?.calls ? getPrimaryCall(tx.value.calls) : undefined))
const type = computed(() => (tx.value?.calls ? getTxCategory(tx.value.calls) : "tx"))

const popupTitle = computed(() => (tx.value?.calls ? getTxTitle(tx.value.calls) : "Transaction"))
const originLabel = computed(() => getOriginLabel(tx.value?.origin))

const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const transferTypeLabel = computed(() => {
	if (!transfer.value || transfer.value.type === undefined || transfer.value.type === null) return null
	return formatTransferType(transfer.value.type)
})
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
	if (type.value !== "mint" || !tx.value?.calls) return 0

	const decimals = new BN(10).pow(tx.value?.origin?.type === OriginType.UI ? 8 : 0)
	let amount = new BN(0)
	for (const c of tx.value.calls) {
		amount = amount.plus(new BN(c.args?.at(-1) || 0))
	}

	return balanceFormatted(amount.dividedBy(decimals), 8).value
})

/** Expandable sections (reset on navigation). */
const showFeeBreakdown = ref(false)
const isDebugExpanded = ref(false)

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

/** Fee method label enriched from the fee-path call when the enum alone is ambiguous. */
const feePaymentLabel = computed(() => {
	const t = tx.value
	if (!t) return null
	const method = t.feePaymentMethod
	if (method === NuloFeePaymentMethod.FeeJuice) return "Public Fee Juice"
	if (method === NuloFeePaymentMethod.FeeJuiceWithClaim) return "Public Fee Juice (with claim)"
	if (method === NuloFeePaymentMethod.External) {
		const fpcMethod = t.calls?.find((c) => FEE_METHODS.has(c.method))?.method
		if (fpcMethod === "sponsor_unconditionally") return "Sponsored"
		if (fpcMethod === "fee_entrypoint_private") return "Private Fee Juice"
		if (t.origin?.type === OriginType.DAPP) return `Set by ${t.origin.name ?? "the app"}`
		return "External FPC"
	}
	return `Unknown (${method})`
})

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
const explorerName = computed(() => {
	return BLOCK_EXPLORERS.find((e) => e.id === appStore.defaultExplorer)?.name ?? "explorer"
})

/** User-facing calls list — excludes fee/entrypoint infrastructure. */
const userCalls = computed(() => {
	if (!tx.value?.calls) return []
	return tx.value.calls.filter((c) => !FEE_METHODS.has(c.method))
})

onMounted(async () => {
	tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
})

onBeforeUnmount(() => {
	tokenService.disconnect()
})
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader :title="popupTitle" :backTo="'/popup/activity'" />

		<Flex v-if="tx" wide direction="column" gap="24" :class="$style.content">
			<!-- Hero — title lives in SubPageHeader above, so this block is
			     just the timestamp + explorer link. -->
			<Flex direction="column" align="center" gap="10">
				<Flex align="center" justify="center" gap="8" :class="$style.hero_meta">
					<span v-if="txTime" :class="$style.tx_time">{{ txTime }}</span>
					<span v-if="txTime && (explorerUrl || tx?.hash)" :class="$style.meta_sep">·</span>
					<a
						v-if="explorerUrl"
						:href="explorerUrl"
						target="_blank"
						rel="noopener noreferrer"
						@click.stop="handleExternalLink($event, explorerUrl)"
						:class="$style.hero_link"
					>
						<span>View on {{ explorerName }}</span>
						<Icon name="external-link" size="10" color="tertiary" />
					</a>
					<span
						v-else-if="tx?.hash"
						@click="handleCopy(tx.hash)"
						:class="[$style.hero_link, 'copyable']"
					>
						<span>Copy hash</span>
						<Icon name="copy" size="10" color="tertiary" />
					</span>
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

			<!-- Transfer type chip + From/To -->
			<Flex v-if="transfer" wide direction="column" gap="10">
				<div v-if="transferTypeLabel" :class="$style.transfer_type_chip">
					{{ transferTypeLabel }}
				</div>

				<Flex wide gap="8">
					<Flex
						wide direction="column" gap="4"
						:class="$style.address_card"
						@click="handleCopy(transfer.from)"
					>
						<AddressDisplay
							static
							size="13"
							weight="600"
							:address="transfer.from"
							:formatter="(addr) => trimAddress(addr, 6, 4)"
						/>
						<span :class="$style.address_label">From</span>
					</Flex>

					<Flex
						wide direction="column" gap="4"
						:class="$style.address_card"
						@click="handleCopy(transfer.to)"
					>
						<AddressDisplay
							static
							size="13"
							weight="600"
							:address="transfer.to"
							:formatter="(addr) => trimAddress(addr, 6, 4)"
						/>
						<span :class="$style.address_label">To</span>
					</Flex>
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

					<Flex v-if="feePaymentLabel" wide justify="between" align="center">
						<span :class="$style.detail_key">Fee method</span>
						<span :class="$style.detail_value">{{ feePaymentLabel }}</span>
					</Flex>

					<Flex v-if="formattedFee" wide direction="column" gap="8">
						<button
							type="button"
							:class="[$style.fee_row_toggle, !hasGasDetails && $style.fee_row_static]"
							:disabled="!hasGasDetails"
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
						</button>

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
						<button
							type="button"
							:class="[$style.fee_row_toggle, !hasGasDetails && $style.fee_row_static]"
							:disabled="!hasGasDetails"
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
						</button>

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

					<Flex v-if="tx?.block" wide justify="between" align="center">
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

					<Flex v-if="tx?.nonce" wide justify="between" align="center">
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

			<!-- Calls (top-level, stacked rows) -->
			<Flex v-if="userCalls.length" wide direction="column" gap="10">
				<SectionLabel label="Calls" :count="userCalls.length" />

				<Flex wide direction="column" :class="$style.calls_box">
					<Flex
						v-for="(c, idx) in userCalls"
						:key="idx"
						direction="column"
						gap="4"
						:class="[$style.call_row, idx > 0 && $style.call_row_divider]"
					>
						<span :class="$style.call_method">{{ humanizeMethodName(c.method) || "Call" }}</span>
						<span
							@click="handleCopy(c.contract)"
							:class="[$style.call_contract, 'copyable']"
						>
							{{ trimAddress(c.contract, 6, 4) }}
						</span>
					</Flex>
				</Flex>
			</Flex>

			<!-- Debug details (collapsed by default) -->
			<Flex wide direction="column" gap="10">
				<button
					type="button"
					@click="isDebugExpanded = !isDebugExpanded"
					:class="$style.debug_toggle"
				>
					<SectionLabel label="Debug details" />
					<Icon
						name="chevron"
						size="12"
						color="tertiary"
						:style="{ transform: `rotate(${isDebugExpanded ? '180' : '0'}deg)`, transition: 'transform 0.2s ease' }"
					/>
				</button>

				<Flex v-if="isDebugExpanded" wide direction="column" gap="12" :class="$style.details_box">
					<Flex wide justify="between" align="center">
						<span :class="$style.detail_key">Tx hash</span>
						<Flex
							@click="handleCopy(tx.hash)"
							align="center" gap="6"
							:class="'copyable'"
						>
							<span :class="$style.detail_value_mono">{{ trimAddress(tx.hash, 8, 6) }}</span>
							<Icon name="copy" size="10" color="tertiary" />
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

					<Flex v-if="tx.calls?.some((c) => 'callIndex' in c || c.chunkNonce || c.isBatch)" wide direction="column" gap="6">
						<span :class="$style.detail_key">Raw calls</span>
						<Flex wide direction="column" gap="4">
							<Flex
								v-for="(c, idx) in tx.calls"
								:key="idx"
								wide direction="column" gap="2"
								:class="$style.raw_call_item"
							>
								<Flex wide justify="between" align="center">
									<Flex align="center" gap="4">
										<span v-if="c.isBatch" :class="$style.detail_value_aux" title="Re-entry call">↩</span>
										<span :class="$style.raw_call_method">{{ c.method ?? "Unknown" }}</span>
									</Flex>
									<span v-if="'callIndex' in c" :class="$style.detail_value_aux">#{{ c.callIndex }}</span>
								</Flex>
								<span
									v-if="c.chunkNonce"
									@click="handleCopy(c.chunkNonce)"
									:class="[$style.raw_call_aux, 'copyable']"
								>
									chunk: {{ trimAddress(c.chunkNonce, 6, 4) }}
								</span>
							</Flex>
						</Flex>
					</Flex>

					<Flex v-if="tx.error" wide direction="column" gap="6">
						<span :class="$style.error_key">Error</span>
						<span :class="$style.error_text">{{ tx.error }}</span>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<!-- Tx not found (user navigated to a hash that isn't in appStore.transactions yet) -->
		<Flex v-else wide direction="column" align="center" gap="12" :class="$style.content">
			<span :class="$style.empty_headline">TRANSACTION NOT FOUND</span>
			<span :class="$style.empty_sub">This hash isn't in your current account history.</span>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	scrollbar-gutter: stable;
	background: var(--app-bg);
}

.content {
	padding: 4px 20px var(--nav-clearance) 20px;
}

/* ── Hero ──────────────────────────────────────────────────────── */

.hero_meta {
	flex-wrap: wrap;
	row-gap: 4px;
}

.tx_time {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);
}

.meta_sep {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-outline);
}

.hero_link {
	display: inline-flex;
	align-items: center;
	gap: 6px;

	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-outline);
	text-decoration: none;
	cursor: pointer;

	transition: color 0.2s var(--bezier);

	& svg {
		transition: fill 0.2s var(--bezier);
	}

	&:hover {
		color: var(--nulo-accent);

		& svg {
			fill: var(--nulo-accent);
		}
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

/* ── Transfer type chip ────────────────────────────────────────── */

.transfer_type_chip {
	align-self: center;

	padding: 5px 12px;
	border: 1px solid var(--nulo-border);
	background: transparent;

	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.15em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

/* ── Address cards ─────────────────────────────────────────────── */

.address_card {
	width: 100%;

	padding: 12px;
	border: 1px solid var(--nulo-border);
	background: transparent;

	cursor: pointer;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);
	}
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

	text-align: right;
	word-break: break-word;
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
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;

	padding: 0;
	background: transparent;
	border: none;
	cursor: pointer;

	color: inherit;
	text-align: inherit;

	transition: opacity 0.2s ease;

	&:hover {
		opacity: 0.8;
	}
}

.fee_row_static {
	cursor: default;

	&:hover {
		opacity: 1;
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

/* ── Calls section ─────────────────────────────────────────────── */

.calls_box {
	width: 100%;

	border: 1px solid var(--nulo-border);
	background: transparent;
}

.call_row {
	width: 100%;

	padding: 10px 12px;
}

.call_row_divider {
	border-top: 1px solid var(--nulo-border);
}

.call_method {
	font-family: var(--font-headline);
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.01em;
	color: var(--txt-primary);

	word-break: break-word;
}

.call_contract {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-secondary);
}

/* ── Debug section ─────────────────────────────────────────────── */

.debug_toggle {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;

	padding: 0;
	background: transparent;
	border: none;
	cursor: pointer;

	color: inherit;
	text-align: inherit;

	transition: opacity 0.2s ease;

	&:hover {
		opacity: 0.8;
	}
}

.raw_call_item {
	padding: 6px 8px;
	border-left: 1px solid var(--nulo-border);
}

.raw_call_method {
	font-family: var(--font-mono);
	font-size: 11px;
	font-weight: 600;
	color: var(--txt-primary);
}

.raw_call_aux {
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

/* ── Empty state ───────────────────────────────────────────────── */

.empty_headline {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
	margin-top: 48px;
}

.empty_sub {
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--nulo-outline);
	text-align: center;
}
</style>
