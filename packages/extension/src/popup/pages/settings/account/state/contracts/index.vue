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
		<SubPageHeader title="Contracts" :backTo="'/popup/settings/account/state'" />

		<Flex direction="column" gap="16" :class="$style.content">
			<Banner v-if="isFetchingContracts" isLoading> Fetching contracts </Banner>

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
				
				<Flex v-for="contract in filteredContracts" justify="between" :class="$style.card">
					<Flex gap="10">
						<Icon name="zap" size="16" color="tertiary" />

						<Flex direction="column" gap="8">
							<Text size="14" weight="600" color="primary"> Contract </Text>
							<AddressDisplay size="13" weight="600" color="tertiary" :address="contract" :formatter="(addr) => trimAddress(addr, 6, 4)" />
							<!-- <Text size="13" weight="600" color="tertiary">
								{{ contract.slice(0, 6) }}
								<Text color="dark">•••</Text>
								{{ contract.slice(-4) }}
							</Text> -->
						</Flex>
					</Flex>
				</Flex>
				<Text v-if="searchTerm" size="12" weight="500" color="tertiary">
					{{ contracts.length - filteredContracts.length }} hidden contracts due to search
				</Text>
			</Flex>

			<Banner v-else> So far, it's empty </Banner>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
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
		box-shadow: inset 0 0 0 1px var(--nulo-outline), 0 1px 2px rgba(10, 9, 8, 0.5);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--nulo-surface-high);
	}
}
</style>
