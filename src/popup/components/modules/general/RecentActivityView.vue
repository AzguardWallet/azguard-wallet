<script setup>
/** Components */
import TransactionCard from "../activity/TransactionCard.vue"
import TransactionAwaitingCard from "../activity/TransactionAwaitingCard.vue"

/** Composables */
import { useDefaultExplorer } from "@/composables/useDefaultExplorer"
const { defaultExplorer } = useDefaultExplorer()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const props = defineProps({
	token: {
		type: Object,
	},
})

const router = useRouter()

const latestTransaction = computed(() => {
	return props.token
		? appStore.transactions.filter(t => t.calls[0]?.contract === props.token?.contract)[0]
		: appStore.transactions[0]
})
const isTokenAwaitingTx = computed(() => {
	return props.token
		? appStore.awaitingTransactions.findIndex(t => t.account === appStore.account.address && t.contract === props.token.contract) > -1
		: false
})
const awaitingAccountTxs = computed(() => {
	return appStore.awaitingTransactions.filter(t => t.account === appStore.account?.address)
})

const handleSelectTx = () => {
	cacheStore.activeTxHash = latestTransaction.value.hash
	popupStore.open("tx")
}
</script>

<template>
	<Flex v-if="token && (isTokenAwaitingTx || latestTransaction)" direction="column" gap="16">
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary"> Latest transaction </Text>
			<Text
				@click="router.push('/popup/activity')"
				size="12"
				weight="600"
				color="tertiary"
				:class="['clickable', $style.txt_button]"
			>
				View all
			</Text>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard v-if="isTokenAwaitingTx" />
			<TransactionCard v-else :tx="latestTransaction" :defaultExplorer="defaultExplorer" @click="handleSelectTx" />
		</div>
	</Flex>
	<Flex v-else-if="!token && (latestTransaction || awaitingAccountTxs.length)" direction="column" gap="16">
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary"> Latest transaction </Text>
			<Text
				@click="router.push('/popup/activity')"
				size="12"
				weight="600"
				color="tertiary"
				:class="['clickable', $style.txt_button]"
			>
				View all
			</Text>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard v-if="awaitingAccountTxs.length" />
			<TransactionCard v-else :tx="latestTransaction" :defaultExplorer="defaultExplorer" @click="handleSelectTx" />
		</div>
	</Flex>
</template>

<style module>
.list {
	margin: -8px;
}

.txt_button {
	transition: all 0.2s var(--bezier);

	&:hover {
		color: var(--txt-secondary);
	}
}
</style>
