<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Services */
import { ExecutionServiceClient } from "@/wallet/services/execution/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

/** Reactive state */
const publicFeeJuice = ref("0")
const privateFeeJuice = ref(null)
const isLoading = ref(true)

const FEE_JUICE_DECIMALS = 18

const formatBalance = (raw) => {
	const amount = new BN(raw)
	if (amount.isZero()) return "0"
	return amount.div(new BN(`1${"0".repeat(FEE_JUICE_DECIMALS)}`)).toFormat(4)
}

const publicFormatted = computed(() => formatBalance(publicFeeJuice.value))
const privateFormatted = computed(() =>
	privateFeeJuice.value !== null ? formatBalance(privateFeeJuice.value) : null,
)

/** Service clients */
const executionService = new ExecutionServiceClient()

/** Functions */
async function loadBalances() {
	try {
		isLoading.value = true
		if (!appStore.account?.address || !appStore.network?.id) return

		const balances = await executionService.getGasBalances(
			appStore.network.id,
			appStore.account.address,
		)
		publicFeeJuice.value = balances.publicFeeJuice
		privateFeeJuice.value = balances.privateFeeJuice
	} catch {
		// silently fail — gas balance is informational
	} finally {
		isLoading.value = false
	}
}

/** Watchers */
watch(
	() => [appStore.account, appStore.network],
	() => loadBalances(),
)

/** Lifecycle */
onMounted(async () => {
	await loadBalances()
})
onBeforeUnmount(() => {
	executionService.disconnect()
})
</script>

<template>
	<Flex direction="column" gap="8" :class="$style.wrapper">
		<Text size="13" weight="600" color="secondary">Gas Balance</Text>

		<Flex direction="column" gap="4">
			<Flex wide align="center" justify="between" :class="$style.item">
				<Flex align="center" gap="6">
					<Icon name="face" size="14" color="orange" />
					<Text size="12" weight="600" color="secondary"> Fee Juice </Text>
					<Text size="10" color="tertiary"> public </Text>
				</Flex>

				<Flex v-if="isLoading" align="center">
					<Spinner color="--txt-tertiary" size="12" />
				</Flex>
				<Text v-else size="12" weight="600" :color="publicFormatted === '0' ? 'tertiary' : 'primary'">
					{{ publicFormatted }} FJ
				</Text>
			</Flex>

			<Flex v-if="privateFormatted !== null" wide align="center" justify="between" :class="$style.item">
				<Flex align="center" gap="6">
					<Icon name="key-square" size="14" color="green" />
					<Text size="12" weight="600" color="secondary"> Private Fee Juice </Text>
					<Text size="10" color="tertiary"> private </Text>
				</Flex>

				<Flex v-if="isLoading" align="center">
					<Spinner color="--txt-tertiary" size="12" />
				</Flex>
				<Text v-else size="12" weight="600" :color="privateFormatted === '0' ? 'tertiary' : 'primary'">
					{{ privateFormatted }} FJ
				</Text>
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
</style>
