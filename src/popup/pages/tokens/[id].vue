<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Services */
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

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
const router = useRouter()

const token = ref()
const tokenBalance = ref()

const tokenService = new TokenServiceClient()
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenDeleted(token) {
	if (token.id === token.value?.id) {
		router.push("/popup/general")
	}
}

const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)
function onBalanceUpdated(tb) {
	if (tb.id !== tokenBalance.value?.id) return
	
	tokenBalance.value = tb
}

watch(
	() => token.value,
	async () => {
		if (token.value) {
			cacheStore.activeTokenIdx = token.value?.id
			tokenBalance.value = (await tokenBalanceService.getTokenBalances(token.value.id, appStore.account.address))?.at(0)
		}
	},
)

watch(
	() => appStore.account,
	async () => {
		tokenBalance.value = (await tokenBalanceService.getTokenBalances(token.value.id, appStore.account.address))?.at(0)
	}
)

onMounted(async () => {
	token.value = await tokenService.getToken(route.params.id)
	if (!token.value) {
		router.push("/popup/general")
	}
})

onBeforeUnmount(() => {
	tokenService.disconnect()
	tokenBalanceService.disconnect()
	cacheStore.activeTokenIdx = null
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<BalanceView :tokenBalance />

		<Flex direction="column" justify="between" :class="$style.content">
			<Flex direction="column" gap="32">
				<Banner v-if="!token?.hasPublicTransfers && !token?.hasPrivateTransfers" variant="warning">
					Private and public transfers disabled
				</Banner>

				<SplittedBalancesView :tokenBalance />

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
