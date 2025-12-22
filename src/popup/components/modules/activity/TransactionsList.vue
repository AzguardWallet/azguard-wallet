<script setup>
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

const handleSelectTx = target => {
	cacheStore.activeTxHash = target.hash
	popupStore.open("tx")
}

async function handleCancelTx(tx) {
	cacheStore.activeTxHash = tx.hash
	popupStore.open("cancel_tx")
}
</script>

<template>
	<Flex direction="column" gap="8">
		<TransactionCard v-for="tx in transactions" :tx @click="handleSelectTx(tx)" @cancelTx="handleCancelTx" />
	</Flex>
</template>

<style module>
.item {
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

.activity_icon {
	position: relative;

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
</style>
