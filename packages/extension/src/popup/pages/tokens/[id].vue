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
import Navigation from "../../components/Navigation.vue"
import RecentActivityView from "../../components/modules/general/RecentActivityView.vue"
import SplittedBalancesView from "../../components/modules/general/SplittedBalancesView.vue"

/** Services */
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

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
		if (!tokenBalance.value) {
			cacheStore.activeTokenIdx = null
			router.push("/popup/general")
		}
	},
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
	background: var(--app-bg);
}

.content {
	flex: 1;

	padding: 24px 24px 96px 24px;
}
</style>
