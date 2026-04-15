<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Services */
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { NuloFeePaymentMethod } from "@/wallet/services/account/contracts"
import { TxStatus } from "@/wallet/services/transaction/spec"

/** Utils */
import { FEE_JUICE_USD_RATE } from "@/utils/fee-estimation"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

/** Reactive state */
const publicFeeJuice = ref("0")
const privateFeeJuice = ref(null)
const isLoading = ref(true)
const hasLoaded = ref(false)

const FEE_JUICE_DECIMALS = 18
const FJ_DIVISOR = new BN(`1${"0".repeat(FEE_JUICE_DECIMALS)}`)

const formatBalance = (raw) => {
	const amount = new BN(raw)
	if (amount.isZero()) return "0"
	return amount.div(FJ_DIVISOR).toFormat(4)
}

const toUsd = (raw) => {
	const amount = new BN(raw)
	if (amount.isZero()) return null
	const usd = amount.div(FJ_DIVISOR).times(FEE_JUICE_USD_RATE)
	if (usd.isLessThan(0.001)) return "<$0.001"
	return `$${usd.toFixed(3)}`
}

const publicFormatted = computed(() => formatBalance(publicFeeJuice.value))
const privateFormatted = computed(() => (privateFeeJuice.value !== null ? formatBalance(privateFeeJuice.value) : null))
const publicUsd = computed(() => toUsd(publicFeeJuice.value))
const privateUsd = computed(() => (privateFeeJuice.value !== null ? toUsd(privateFeeJuice.value) : null))

/** Service clients */
const executionService = new ExecutionServiceClient()
const transactionService = new TransactionServiceClient()

/** Transaction subscription handlers */
function onTransactionAdded(tx) {
	if (tx.account !== appStore.account?.address) return
	if (!tx.estimatedFee) return

	if (tx.feePaymentMethod === NuloFeePaymentMethod.FeeJuice || tx.feePaymentMethod === NuloFeePaymentMethod.FeeJuiceWithClaim) {
		const current = new BN(publicFeeJuice.value)
		const deduction = new BN(tx.estimatedFee)
		publicFeeJuice.value = BN.max(current.minus(deduction), new BN(0)).toFixed(0)
	}
	// For External (FPC): skip optimistic deduction — real refresh on completion handles it.
}

function onTransactionUpdated(tx) {
	if (tx.account !== appStore.account?.address) return
	if (tx.status !== TxStatus.Pending) {
		loadBalances(true)
	}
}

transactionService.onTransactionAdded.add(onTransactionAdded)
transactionService.onTransactionUpdated.add(onTransactionUpdated)

/** Functions */
async function loadBalances(forceRefresh = false) {
	try {
		if (!hasLoaded.value) isLoading.value = true
		if (!appStore.account?.address || !appStore.network?.id) return

		const balances = await executionService.getGasBalances(appStore.network.id, appStore.account.address, forceRefresh)
		publicFeeJuice.value = balances.publicFeeJuice
		privateFeeJuice.value = balances.privateFeeJuice
		hasLoaded.value = true
	} catch {
		// silently fail — gas balance is informational
	} finally {
		isLoading.value = false
	}
}

/** Watchers */
watch(
	() => [appStore.account?.address, appStore.network?.id],
	([newAccount, newNetwork], [oldAccount, oldNetwork]) => {
		if (newAccount !== oldAccount || newNetwork !== oldNetwork) {
			hasLoaded.value = false
			loadBalances()
		}
	},
)

/** Lifecycle */
onMounted(async () => {
	transactionService.connect()
	await loadBalances()
})
onBeforeUnmount(() => {
	executionService.disconnect()
	transactionService.disconnect()
})
</script>

<template>
	<div :class="$style.wrapper">
		<div :class="[$style.grid, !(isLoading || privateFormatted !== null) && $style.single_col]">
			<div :class="$style.col">
				<span :class="$style.label">Public Juice</span>
				<span v-if="isLoading" :class="$style.skeleton" />
				<span v-else :class="$style.amount" data-testid="gas-balance-public">{{ publicFormatted }} FJ</span>
			</div>

			<div v-if="isLoading || privateFormatted !== null" :class="[$style.col, $style.col_right]">
				<span :class="$style.label">Private Fee Juice</span>
				<span v-if="isLoading" :class="$style.skeleton" />
				<span v-else :class="$style.amount" data-testid="gas-balance-private">{{ privateFormatted }} FJ</span>
			</div>
		</div>
	</div>
</template>

<style module>
.wrapper {
	width: 100%;
	max-width: 280px;
	margin: 0 auto;
	padding-top: 16px;
	border-top: 1px solid rgba(74, 70, 63, 0.2);
}

.grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
}

.single_col {
	grid-template-columns: 1fr;
}

.col {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.col_right {
	align-items: flex-end;
}

.label {
	font-family: var(--font-mono);
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--nulo-secondary);
}

.amount {
	font-family: var(--font-mono);
	font-size: 12px;
	font-weight: 500;
	color: var(--nulo-accent);
}

.skeleton {
	display: inline-block;
	width: 60px;
	height: 12px;
	background: linear-gradient(90deg, var(--nulo-surface-high) 25%, var(--nulo-surface) 50%, var(--nulo-surface-high) 75%);
	background-size: 200% 100%;
	animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
	0% { background-position: 200% 0; }
	100% { background-position: -200% 0; }
}
</style>
