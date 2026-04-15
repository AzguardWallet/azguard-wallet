<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"
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
const configService = new ConfigServiceClient()
const isDebugMode = ref(false)

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

watch(
	() => props.show,
	async () => {
		if (props.show) {
			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
			isDebugMode.value = await configService.getValue("debugMode")
		} else {
			tokenService.disconnect()
			configService.disconnect()
			showFeeBreakdown.value = false
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

/** Fee breakdown toggle + computed details */
const showFeeBreakdown = ref(false)
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
			<Flex wide direction="column" align="center" gap="32" :class="$style.wrapper">
				<Flex direction="column" align="center" gap="12">
					<Flex align="center" gap="6">
						<Icon name="zap-circle" size="16" color="primary" />
						<Text size="16" weight="600" color="primary">
							{{ popupTitle }}
						</Text>
					</Flex>

					<Text v-if="txTime" size="12" weight="500" color="tertiary">
						{{ txTime }}
					</Text>

					<Flex align="start" gap="6" :class="$style.hash_row">
						<Text @click="handleCopy(tx.hash)" size="12" weight="500" color="tertiary" class="copyable" :style="{ wordBreak: 'break-all', lineHeight: '1.4', flex: 1 }">
							{{ tx.hash }}
						</Text>
						<Flex align="center" gap="4" :style="{ flexShrink: 0, marginTop: '2px' }">
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

				<Flex v-if="originLabel || tx.feePaymentMethod != null || formattedFee || formattedEstFee || tx.calls?.length" wide direction="column" gap="8" :class="$style.info_section">
					<Flex v-if="originLabel" wide justify="between" align="center">
						<Text size="12" weight="500" color="tertiary">App</Text>
						<Text size="12" weight="600" color="primary">{{ originLabel }}</Text>
					</Flex>

					<Flex v-if="tx.feePaymentMethod != null" wide justify="between" align="center">
						<Text size="12" weight="500" color="tertiary">Fee method</Text>
						<Text size="12" weight="600" color="primary">{{ getFeePaymentMethodName(tx.feePaymentMethod) }}</Text>
					</Flex>

					<Flex v-if="formattedFee" wide direction="column" gap="6">
						<Flex
							wide justify="between" align="center"
							:class="hasGasDetails && $style.fee_row_toggle"
							@click="hasGasDetails && (showFeeBreakdown = !showFeeBreakdown)"
						>
							<Flex align="center" gap="4">
								<Text size="12" weight="500" color="tertiary">Fee paid</Text>
								<Icon
									v-if="hasGasDetails"
									name="chevron"
									size="10"
									color="tertiary"
									:style="{ transform: `rotate(${showFeeBreakdown ? '180' : '0'}deg)`, transition: 'transform 0.2s ease' }"
								/>
							</Flex>
							<Flex align="center" gap="4">
								<Text size="12" weight="600" color="primary">{{ formattedFee }} FJ</Text>
								<Text size="10" color="tertiary">{{ formattedFeeUsd }}</Text>
							</Flex>
						</Flex>

						<Flex v-if="showFeeBreakdown && gasBreakdown" wide direction="column" gap="4" :class="$style.fee_breakdown">
							<div :class="$style.fee_grid">
								<Text size="11" weight="500" color="tertiary">L2 Gas</Text>
								<Text size="11" weight="500" color="tertiary" :class="$style.fee_grid_num">{{ gasBreakdown.l2Gas }}</Text>
								<Text size="11" weight="600" color="secondary" :class="$style.fee_grid_num">{{ gasBreakdown.l2Cost }} FJ</Text>

								<Text size="11" weight="500" color="tertiary">DA Gas</Text>
								<Text size="11" weight="500" color="tertiary" :class="$style.fee_grid_num">{{ gasBreakdown.daGas }}</Text>
								<Text size="11" weight="600" color="secondary" :class="$style.fee_grid_num">{{ gasBreakdown.daCost }} FJ</Text>

								<template v-if="gasBreakdown.hasTeardown">
									<Text size="11" weight="500" color="tertiary">Teardown</Text>
									<Text size="11" weight="500" color="tertiary" :class="$style.fee_grid_num">{{ gasBreakdown.teardownL2Gas }} + {{ gasBreakdown.teardownDaGas }}</Text>
									<Text size="11" weight="600" color="secondary" :class="$style.fee_grid_num">{{ gasBreakdown.teardownCost }} FJ</Text>
								</template>
							</div>
							<Flex v-if="formattedEstFee" wide justify="between" align="center" :class="$style.fee_breakdown_divider">
								<Text size="11" weight="500" color="tertiary">Estimated</Text>
								<Text size="11" weight="600" color="secondary">{{ formattedEstFee }} FJ</Text>
							</Flex>
							<Flex v-if="feeSavings" wide justify="end">
								<Text size="10" weight="500" color="green">{{ feeSavings }}</Text>
							</Flex>
						</Flex>
					</Flex>

					<Flex v-else-if="formattedEstFee" wide direction="column" gap="6">
						<Flex
							wide justify="between" align="center"
							:class="hasGasDetails && $style.fee_row_toggle"
							@click="hasGasDetails && (showFeeBreakdown = !showFeeBreakdown)"
						>
							<Flex align="center" gap="4">
								<Text size="12" weight="500" color="tertiary">Estimated fee</Text>
								<Icon
									v-if="hasGasDetails"
									name="chevron"
									size="10"
									color="tertiary"
									:style="{ transform: `rotate(${showFeeBreakdown ? '180' : '0'}deg)`, transition: 'transform 0.2s ease' }"
								/>
							</Flex>
							<Flex align="center" gap="4">
								<Text size="12" weight="600" color="tertiary">~{{ formattedEstFee }} FJ</Text>
								<Text size="10" color="tertiary">{{ formattedEstFeeUsd }}</Text>
							</Flex>
						</Flex>

						<Flex v-if="showFeeBreakdown && gasBreakdown" wide direction="column" gap="4" :class="$style.fee_breakdown">
							<div :class="$style.fee_grid">
								<Text size="11" weight="500" color="tertiary">L2 Gas</Text>
								<Text size="11" weight="500" color="tertiary" :class="$style.fee_grid_num">{{ gasBreakdown.l2Gas }}</Text>
								<Text size="11" weight="600" color="secondary" :class="$style.fee_grid_num">{{ gasBreakdown.l2Cost }} FJ</Text>

								<Text size="11" weight="500" color="tertiary">DA Gas</Text>
								<Text size="11" weight="500" color="tertiary" :class="$style.fee_grid_num">{{ gasBreakdown.daGas }}</Text>
								<Text size="11" weight="600" color="secondary" :class="$style.fee_grid_num">{{ gasBreakdown.daCost }} FJ</Text>

								<template v-if="gasBreakdown.hasTeardown">
									<Text size="11" weight="500" color="tertiary">Teardown</Text>
									<Text size="11" weight="500" color="tertiary" :class="$style.fee_grid_num">{{ gasBreakdown.teardownL2Gas }} + {{ gasBreakdown.teardownDaGas }}</Text>
									<Text size="11" weight="600" color="secondary" :class="$style.fee_grid_num">{{ gasBreakdown.teardownCost }} FJ</Text>
								</template>
							</div>
						</Flex>
					</Flex>

					<Flex v-if="tx.calls?.length" wide direction="column" gap="4">
						<Text size="12" weight="500" color="tertiary">Calls</Text>
						<Flex wide direction="column" gap="2" :class="$style.calls_summary">
							<Flex
								v-for="(c, idx) in tx.calls"
								:key="idx"
								wide
								justify="between"
								align="center"
								:class="$style.call_summary_item"
							>
								<Text size="11" weight="600" color="primary">{{ humanizeMethodName(c.method) }}</Text>
								<Text size="11" weight="500" color="tertiary" @click="handleCopy(c.contract)" class="copyable">{{ trimAddress(c.contract, 6, 4) }}</Text>
							</Flex>
						</Flex>
					</Flex>
				</Flex>

				<Flex v-if="isDebugMode" wide direction="column" gap="8" :class="$style.debug_section">
					<Text size="11" weight="600" color="secondary" style="text-transform: uppercase; letter-spacing: 0.5px;">
						Tx Debug Details
					</Text>

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

.hash_row {
	background: var(--gray-3);
	border-radius: 8px;
	padding: 8px 10px;
	width: 100%;
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

.info_section {
	background: var(--gray-3);
	border-radius: 8px;
	padding: 12px;
}

.fee_row_toggle {
	cursor: pointer;
	border-radius: 4px;
	padding: 2px 0;
	transition: opacity 0.2s ease;

	&:hover {
		opacity: 0.8;
	}
}

.fee_breakdown {
	background: var(--gray-5);
	border-radius: 6px;
	padding: 8px 10px;
}

.fee_grid {
	display: grid;
	grid-template-columns: auto 1fr auto;
	gap: 4px 8px;
	align-items: center;
}

.fee_grid_num {
	text-align: right;
}

.fee_breakdown_divider {
	border-top: 1px solid var(--gray-10);
	padding-top: 6px;
	margin-top: 2px;
}

.calls_summary {
	max-height: 120px;
	overflow-y: auto;
}

.call_summary_item {
	padding: 4px 6px;
	background: var(--gray-5);
	border-radius: 4px;
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

.error_text {
	word-break: break-word;
	padding: 6px;
	background: rgba(255, 0, 0, 0.05);
	border-radius: 4px;
	border: 1px solid rgba(255, 0, 0, 0.2);
}
</style>
