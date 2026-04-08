<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Services */
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { AzguardFeePaymentMethod } from "@/wallet/services/account/contracts"
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

	if (tx.feePaymentMethod === AzguardFeePaymentMethod.FeeJuice || tx.feePaymentMethod === AzguardFeePaymentMethod.FeeJuiceWithClaim) {
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
	<Flex direction="column" gap="8" :class="$style.wrapper">
		<Flex align="center" gap="6">
			<Text size="13" weight="600" color="secondary">Fee Balance</Text>
			<Spinner v-if="isLoading" color="--txt-tertiary" size="12" />
		</Flex>

		<Flex direction="column" gap="4">
			<Flex wide align="center" justify="between" :class="$style.item">
				<Flex align="center" gap="6">
					<Icon name="face" size="14" color="orange" />
					<Text size="12" weight="600" color="secondary"> Fee Juice </Text>
					<Text size="10" color="tertiary"> public </Text>
				</Flex>

				<Flex v-if="isLoading" align="center" gap="6">
					<span :class="$style.skeleton" style="width: 60px" />
					<span :class="$style.skeleton" style="width: 36px" />
				</Flex>
				<Flex v-else align="center" gap="6">
					<Text size="12" weight="600" :color="publicFormatted === '0' ? 'tertiary' : 'primary'">
						{{ publicFormatted }} FJ
					</Text>
					<Text v-if="publicUsd" size="10" color="tertiary">{{ publicUsd }}</Text>
				</Flex>
			</Flex>

			<Flex v-if="isLoading || privateFormatted !== null" wide align="center" justify="between" :class="$style.item">
				<Flex align="center" gap="6">
					<Icon name="key-square" size="14" color="green" />
					<Text size="12" weight="600" color="secondary"> Private Fee Juice </Text>
					<Text size="10" color="tertiary"> private </Text>
				</Flex>

				<Flex v-if="isLoading" align="center" gap="6">
					<span :class="$style.skeleton" style="width: 60px" />
					<span :class="$style.skeleton" style="width: 36px" />
				</Flex>
				<Flex v-else align="center" gap="6">
					<Text size="12" weight="600" :color="privateFormatted === '0' ? 'tertiary' : 'primary'">
						{{ privateFormatted }} FJ
					</Text>
					<Text v-if="privateUsd" size="10" color="tertiary">{{ privateUsd }}</Text>
				</Flex>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;
}

.item {
	background: var(--gray-5);
	border-radius: 8px;

	padding: 8px 12px;
}

.skeleton {
	display: inline-block;
	height: 12px;
	border-radius: 4px;
	background: linear-gradient(90deg, var(--gray-10) 25%, var(--gray-5) 50%, var(--gray-10) 75%);
	background-size: 200% 100%;
	animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
	0% { background-position: 200% 0; }
	100% { background-position: -200% 0; }
}
</style>
