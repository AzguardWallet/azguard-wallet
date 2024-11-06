<script setup>
/** Components */
import BalanceView from "../components/modules/general/BalanceView.vue"
import ActionButtonsView from "../components/modules/general/ActionButtonsView.vue"
import WarningView from "../components/modules/general/WarningView.vue"
import TokensView from "../components/modules/general/TokensView.vue"
import RecentActivityView from "../components/modules/general/RecentActivityView.vue"
import Navigation from "../components/Navigation.vue"
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<BalanceView />

		<Flex direction="column" gap="32" :class="$style.content">
			<ActionButtonsView />
			<WarningView />
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

	background: #fff;
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding-top: 20px;

	&::-webkit-scrollbar {
		display: none;
	}
}

.content {
	flex: 1;

	border-top: 1px solid var(--gray-10);
	background: linear-gradient(rgba(0, 0, 0, 3%), rgba(0, 0, 0, 0%));

	padding: 24px 20px 0 20px;
}
</style>
