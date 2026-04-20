<route lang="json">
{
	"meta": {
		"title": "History",
		"isAuthRequired": true,
		"showBottomNav": true
	}
}
</route>

<script setup>
/** Components */
import TransactionsList from "../components/modules/activity/TransactionsList.vue"

/** Services */
import { TransactionServiceClient } from "@/wallet/services/transaction/client"

/** Store */
import { useAppStore } from "@/stores/app.store"

const appStore = useAppStore()

/** Service clients */
const transactionService = new TransactionServiceClient()

/** Hero visibility → compact sticky title fade */
const heroRef = useTemplateRef("heroRef")
const heroVisible = ref(true)
let heroObserver = null

/** Lifecycle hooks */
onMounted(() => {
	if (heroRef.value) {
		heroObserver = new IntersectionObserver(
			([entry]) => {
				heroVisible.value = entry.isIntersecting
			},
			{ threshold: 0 },
		)
		heroObserver.observe(heroRef.value)
	}
})

onBeforeUnmount(() => {
	transactionService.disconnect()
	heroObserver?.disconnect()
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<div :class="[$style.page_title_bar, !heroVisible && $style.page_title_bar_visible]">
			<span :class="$style.page_title_label">HISTORY</span>
		</div>

		<div ref="heroRef">
			<Flex direction="column" align="center" gap="16" :class="$style.hero">
				<h1 :class="$style.hero_title">HISTORY</h1>
				<div :class="$style.hero_bar" />
			</Flex>
		</div>

		<Flex direction="column" gap="24" :class="$style.content">
			<!-- Transactions list -->
			<TransactionsList v-if="appStore.transactions.length" :transactions="appStore.transactions" />

			<!-- Empty state -->
			<Flex
				v-else
				direction="column"
				align="center"
				gap="12"
				:class="$style.empty_banner"
			>
				<MaterialIcon name="history" :size="32" color="secondary" />
				<span :class="$style.empty_title">No transactions yet</span>
				<span :class="$style.empty_description">
					Once you start working with your assets, all activity will appear here
				</span>
			</Flex>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);

	padding-bottom: var(--nav-clearance);
}

.page_title_bar {
	position: sticky;
	top: 0;
	z-index: 5;

	display: flex;
	align-items: center;

	padding: 12px 24px;

	background: var(--app-bg);

	opacity: 0;
	pointer-events: none;

	transition: opacity 0.18s cubic-bezier(0.4, 0, 1, 1);
}

.page_title_bar_visible {
	opacity: 1;
	pointer-events: auto;
}

.page_title_label {
	font-family: var(--font-headline);
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--txt-primary);

	text-decoration: underline;
	text-decoration-color: var(--nulo-accent);
	text-decoration-thickness: 2px;
	text-underline-offset: 4px;
}

.hero {
	padding: 0 24px 32px 24px;
}

.hero_title {
	font-family: var(--font-headline);
	font-size: 48px;
	font-weight: 700;
	letter-spacing: -0.04em;
	text-transform: uppercase;
	color: var(--txt-primary);
	line-height: 1;
	margin: 0;
}

.hero_bar {
	width: 24px;
	height: 1px;
	background: var(--nulo-accent);
}

.content {
	padding: 0 24px;
}

.empty_banner {
	max-width: 280px;
	margin: 48px auto 0 auto;
	text-align: center;
}

.empty_title {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 600;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
}

.empty_description {
	font-family: var(--font-body);
	font-size: 12px;
	line-height: 1.5;
	color: var(--nulo-secondary);
}
</style>
