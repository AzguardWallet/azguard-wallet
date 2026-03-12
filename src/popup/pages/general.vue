<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import BalanceView from "../components/modules/general/BalanceView.vue"
import WarningView from "../components/modules/general/WarningView.vue"
import TokensView from "../components/modules/general/TokensView.vue"
import RecentActivityView from "../components/modules/general/RecentActivityView.vue"
import GasBalanceCard from "../components/modules/general/GasBalanceCard.vue"
import Navigation from "../components/Navigation.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<BalanceView />

		<Flex direction="column" gap="32" :class="$style.content">
			<WarningView />
			<GasBalanceCard />
			<RecentActivityView />
			<TokensView />
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
	border-top: 1px solid var(--gray-10);
	background: linear-gradient(rgba(0, 0, 0, 3%), rgba(0, 0, 0, 0%));

	padding: 20px 20px 80px 20px;
}
</style>
