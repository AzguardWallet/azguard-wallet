<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */

/** Utils */
import { AccountStateServiceClient } from "@/wallet/services/account-state/client"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const accountStateService = new AccountStateServiceClient()
const contracts = ref([])
const searchTerm = ref()
const filteredContracts = computed(() =>
	searchTerm.value ? contracts.value.filter((contract) => contract.includes(searchTerm.value?.toLowerCase())) : contracts.value,
)
const isFetchingContracts = ref(false)
const error = ref()
const isErrorOccurred = computed(() => !!error.value)
const fetchContracts = async (isRefetching) => {
	if (isRefetching) openToast({ label: "Fetching contracts again", icon: "zap" })
	isFetchingContracts.value = true

	try {
		contracts.value = await accountStateService.getContracts(appStore.network.id)
	} catch (err) {
		error.value = err
	} finally {
		isFetchingContracts.value = false
	}
}

watch(
	() => appStore.account,
	() => {
		fetchContracts()
	},
)

onMounted(async () => {
	if (appStore.network && appStore.isLogined) fetchContracts()
})

onBeforeUnmount(() => {
	accountStateService.disconnect()
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<SubPageHeader title="Contracts" :backTo="'/popup/settings/advanced/account-state'" />

		<Flex direction="column" gap="16" :class="$style.content">
			<LoadingState v-if="isFetchingContracts" label="FETCHING CONTRACTS" />

			<Tooltip v-else-if="isErrorOccurred" wide>
				<Banner :action="{ name: 'Try again', callback: () => fetchContracts(true) }" variant="error" wide>
					Something went wrong
				</Banner>

				<template #content>
					{{ error }}
				</template>
			</Tooltip>

			<Flex v-else-if="contracts.length" direction="column" gap="8">
				<Input
					v-model="searchTerm"
					icon="search"
					placeholder="Search through contracts"
					clearable
					@clear="searchTerm = ''"
				/>

				<div v-if="searchTerm && filteredContracts.length === 0" :class="$style.no_results">
					NO MATCHES · TRY A DIFFERENT TERM
				</div>

				<Flex v-else v-for="contract in filteredContracts" justify="between" :class="$style.card">
					<Flex gap="10">
						<Icon name="zap" size="16" color="tertiary" />

						<Flex direction="column" gap="8">
							<Text size="14" weight="600" color="primary"> Contract </Text>
							<AddressDisplay size="13" weight="600" color="tertiary" :address="contract" :formatter="(addr) => trimAddress(addr, 6, 4)" />
						</Flex>
					</Flex>
				</Flex>
			</Flex>

			<div v-else :class="$style.empty">
				<span :class="$style.empty_headline">NO CONTRACTS YET</span>
				<span :class="$style.empty_sub">Contracts registered to your account will appear here.</span>
			</div>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
	scrollbar-gutter: stable;
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.card {
	border-radius: 0;
	cursor: pointer;
	border: 1px solid var(--nulo-border);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);
		border-color: var(--nulo-outline);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--nulo-surface-high);
	}
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;

	padding: 32px 16px;
	border: 1px dashed var(--nulo-border);

	text-align: center;
}

.empty_headline {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.empty_sub {
	width: 100%;

	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-outline);
	overflow-wrap: break-word;
}

.no_results {
	padding: 24px 16px;
	text-align: center;

	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.1em;
	color: var(--nulo-outline);
}
</style>
