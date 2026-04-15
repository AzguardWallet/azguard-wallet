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
import Navigation from "../components/Navigation.vue"
import RecentActivityView from "../components/modules/general/RecentActivityView.vue"
import TokensView from "../components/modules/general/TokensView.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<BalanceView />

		<Flex direction="column" gap="40" :class="$style.content">
			<TokensView />
			<RecentActivityView />
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
	padding: 0 24px 96px 24px;
}
</style>
