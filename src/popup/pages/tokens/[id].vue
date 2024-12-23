<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import BalanceView from "../../components/modules/general/BalanceView.vue"
import SplittedBalancesView from "../../components/modules/general/SplittedBalancesView.vue"
import RecentActivityView from "../../components/modules/general/RecentActivityView.vue"
import Navigation from "../../components/Navigation.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()

const route = useRoute()

const token = computed(() =>
	// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
	appStore.tokens.find(t => t.id == route.params.id),
)
watch(
	() => token.value,
	() => {
		cacheStore.activeTokenIdx = token.value?.id
	},
)

onMounted(() => {
	cacheStore.activeTokenIdx = token.value?.id
})

onBeforeUnmount(() => {
	cacheStore.activeTokenIdx = null
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<BalanceView :token />

		<Flex direction="column" justify="between" :class="$style.content">
			<Flex direction="column" gap="32">
				<Banner v-if="!token?.hasPublicTransfers && !token?.hasPrivateTransfers" variant="error">
					Private and public transfers disabled
				</Banner>

				<SplittedBalancesView :token />

				<RecentActivityView :token />
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;
}

.content {
	flex: 1;

	border-top: 1px solid var(--gray-10);
	background: linear-gradient(rgba(0, 0, 0, 3%), rgba(0, 0, 0, 0%));

	padding: 20px 20px 80px 20px;
}
</style>
