<script setup>
/** Components */
import TransactionCard from "./TransactionCard.vue"

/** Vendor */
import { DateTime } from "luxon"

const router = useRouter()

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
		const dateKey = DateTime.fromMillis(tx.updatedAt).toFormat("MMM d, yyyy").toUpperCase()
		if (!groups.has(dateKey)) {
			groups.set(dateKey, [])
		}
		groups.get(dateKey).push(tx)
	}

	return Array.from(groups, ([date, transactions]) => ({ date, transactions }))
})

const handleSelectTx = (target) => {
	router.push(`/popup/tx/${target.hash}`)
}
</script>

<template>
	<Flex direction="column" gap="24">
		<Flex v-for="group in groupedTransactions" :key="group.date" direction="column" gap="4">
			<!-- Date separator -->
			<Flex align="center" gap="12" :class="$style.date_separator">
				<span :class="$style.date_label">{{ group.date }}</span>
				<div :class="$style.separator_line" />
			</Flex>

			<!-- Transactions for this date -->
			<TransactionCard
				v-for="tx in group.transactions"
				:key="tx.hash"
				:tx="tx"
				@click="handleSelectTx(tx)"
			/>
		</Flex>
	</Flex>
</template>

<style module>
.date_separator {
	padding-bottom: 8px;
}

.date_label {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.15em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
	flex-shrink: 0;
}

.separator_line {
	flex: 1;
	height: 1px;
	background: var(--nulo-border);
}
</style>
