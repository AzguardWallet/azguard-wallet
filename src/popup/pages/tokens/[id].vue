<script setup>
/** Components */
import BalanceView from "../../components/modules/general/BalanceView.vue"
import RecentActivityView from "../../components/modules/general/RecentActivityView.vue"
import Navigation from "../../components/Navigation.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()
const route = useRoute()

const token = computed(() =>
	// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
	appStore.tokens.find((t) => t.id == route.params.id)
)

onMounted(async () => {
	if (!appStore.isLogined && appStore.isSessionChecked)
		router.push("/popup/auth")
})

watch(
	() => appStore.isSessionChecked,
	() => {
		if (!appStore.isLogined && appStore.isSessionChecked)
			router.push("/popup/auth")
	}
)
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<BalanceView :token />

		<Flex direction="column" gap="32" :class="$style.content">
			<RecentActivityView />
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
