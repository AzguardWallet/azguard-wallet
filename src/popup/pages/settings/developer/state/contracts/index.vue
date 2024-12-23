<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../../components/Navigation.vue"

/** Utils */
import { managers } from "@/utils/core.js"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const contracts = ref([])
const searchTerm = ref()
const filteredContracts = computed(() =>
	searchTerm.value
		? contracts.value.filter(contract => contract.includes(searchTerm.value?.toLowerCase()))
		: contracts.value,
)
const isFetchingContracts = ref(false)
const error = ref()
const isErrorOccurred = computed(() => !!error.value)
const fetchContracts = async isRefetching => {
	if (isRefetching) openToast({ label: "Fetching contracts again", icon: "zap" })
	isFetchingContracts.value = true

	try {
		contracts.value = await managers.pxe.getContracts(appStore.network.id, appStore.account.address)
	} catch (err) {
		error.value = err

		isFetchingContracts.value = false
	} finally {
		isFetchingContracts.value = false
	}
}

onMounted(async () => {
	if (appStore.network && appStore.isLogined) fetchContracts()
})

watch(
	() => appStore.account,
	() => {
		fetchContracts()
	},
)
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" gap="12" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Settings </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/developer">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Developer </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/developer/state">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> State </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Contracts </Text>
		</Flex>

		<Flex direction="column" gap="16">
			<Text size="16" weight="600" color="primary">Contracts</Text>

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
				<Input v-model="searchTerm" icon="search" placeholder="Search through contracts" clearable />
				<Flex v-for="contract in filteredContracts" justify="between" :class="$style.card">
					<Flex gap="10">
						<Icon name="zap" size="16" color="tertiary" />

						<Flex direction="column" gap="8">
							<Text size="14" weight="600" color="primary"> Contract </Text>
							<Text size="13" weight="600" color="tertiary">
								{{ contract.slice(0, 6) }} ••• {{ contract.slice(-4) }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
				<Text v-if="searchTerm" size="12" weight="500" color="tertiary">
					{{ contracts.length - filteredContracts.length }} hidden contracts due to search
				</Text>
			</Flex>

			<Banner v-else> So far, it's empty </Banner>
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

	padding: 20px 24px 80px 24px;
}

.card {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-10);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}
</style>
