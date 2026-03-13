<script setup>
/** Vendor */
import { DateTime } from "luxon"

/** Components */
import TransactionCard from "./TransactionCard.vue"

/** Store */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const props = defineProps({
	transactions: {
		type: Array,
	},
})

/**
 * Group transactions by date (format: "Nov 26")
 * Returns array of { date: string, transactions: [] }
 */
const groupedTransactions = computed(() => {
	if (!props.transactions?.length) return []

	const groups = new Map()

	for (const tx of props.transactions) {
		const dateKey = DateTime.fromMillis(tx.updatedAt).toFormat("LLL d")
		if (!groups.has(dateKey)) {
			groups.set(dateKey, [])
		}
		groups.get(dateKey).push(tx)
	}

	return Array.from(groups, ([date, transactions]) => ({ date, transactions }))
})

const handleSelectTx = (target) => {
	cacheStore.activeTxHash = target.hash
	popupStore.open("tx")
}

function handleCancelTx(tx) {
	cacheStore.activeTxHash = tx.hash
	popupStore.open("cancel_tx")
}
</script>

<template>
	<Flex direction="column" gap="16">
		<Flex v-for="group in groupedTransactions" :key="group.date" direction="column" gap="8">
			<!-- Date separator -->
			<Flex align="center" justify="end" gap="12" wide :class="$style.date_separator">
				<Text size="12" weight="600" color="tertiary">{{ group.date }}</Text>
				<div :class="$style.separator_line" />
			</Flex>

			<!-- Transactions for this date -->
			<TransactionCard
				v-for="tx in group.transactions"
				:key="tx.hash"
				:tx="tx"
				@click="handleSelectTx(tx)"
				@cancelTx="handleCancelTx(tx)"
			/>
		</Flex>
	</Flex>
</template>

<style module>
.date_separator {
	padding: 0 8px 6px 8px;
}

.separator_line {
	flex: 1;
	height: 1px;
	background: var(--gray-5);
}
</style>
