<script setup>
/** Components */
import TransactionCard from "../activity/TransactionCard.vue"
import TransactionAwaitingCard from "../activity/TransactionAwaitingCard.vue"

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

const availableTokensIdx = computed(() => appStore.tokens.map(t => t.contract))
const latestTransaction = computed(() =>
	props.token
		? appStore.transactions.filter(t => t.calls[0]?.contract === props.token?.contract)[0]
		: appStore.transactions[0],
)

const handleSelectTx = () => {
	cacheStore.activeTxHash = latestTransaction.value.hash
	popupStore.open("tx")
}
</script>

<template>
	<Flex v-if="latestTransaction" direction="column" gap="16">
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
			<TransactionCard v-if="!appStore.isAwaitingTransaction" :tx="latestTransaction" @click="handleSelectTx" />
			<TransactionAwaitingCard v-else />
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
