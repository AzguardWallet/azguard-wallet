<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
import { Dropdown, DropdownItem, DropdownTrigger } from "@/components/ui/Dropdown"

/** Utils */
import { getAvailableExplorers, getEffectiveExplorerId } from "@/wallet/constants/explorers"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.edit_network?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const networkToEdit = computed(() => appStore.networks.find((n) => n.id === cacheStore.networkToEditIdx))

// Get available explorers for this network's chainId
const availableExplorers = computed(() => {
	if (!networkToEdit.value?.chainId) return []
	return getAvailableExplorers(networkToEdit.value.chainId)
})

// Show explorer selector only if explorers are available
const hasExplorers = computed(() => availableExplorers.value.length > 0)

const existingNetworkNames = computed(() => appStore.networks.filter((n) => n.id !== networkToEdit.value.id).map((n) => n.name))
const existingNetworkUrls = computed(() => appStore.networks.filter((n) => n.id !== networkToEdit.value.id).map((n) => n.rpcUrl))

const isStartedEditingName = ref(false)
const isStartedEditingUrl = ref(false)
const isStartedEditingExplorer = ref(false)

const nameTerm = ref("")
const urlTerm = ref("")
const selectedExplorer = ref(undefined)
const handleFillFieldsWithDefaultValues = () => {
	nameTerm.value = networkToEdit.value.name
	urlTerm.value = networkToEdit.value.rpcUrl
	// Use network's selected explorer or get default for chainId
	selectedExplorer.value = networkToEdit.value.selectedExplorerId ||
		getEffectiveExplorerId(networkToEdit.value.chainId)

	isStartedEditingName.value = false
	isStartedEditingUrl.value = false
	isStartedEditingExplorer.value = false
}

const isNameAlreadyExist = computed(() => existingNetworkNames.value.includes(nameTerm.value) && isStartedEditingName.value)
const isUrlAlreadyExist = computed(() => existingNetworkUrls.value.includes(urlTerm.value) && isStartedEditingUrl.value)

const isAvailableToUpdateNetwork = computed(() => {
	// Basic validation
	if (!nameTerm.value.length) return false
	if (!urlTerm.value.length) return false
	if (urlTerm.value.length < 5) return false

	// Check if anything actually changed
	const noChanges =
		nameTerm.value === networkToEdit.value.name &&
		urlTerm.value === networkToEdit.value.rpcUrl &&
		selectedExplorer.value === networkToEdit.value.selectedExplorerId
	if (noChanges) return false

	// Check for conflicts with other networks
	if (isNameAlreadyExist.value || isUrlAlreadyExist.value) return false

	return true
})

const isNetworkUpdateInProgress = ref(false)
const handleUpdateNetwork = async () => {
	if (!isAvailableToUpdateNetwork.value) return

	isNetworkUpdateInProgress.value = true

	// Update network with new values including selected explorer
	await appStore.updateNetwork(
		cacheStore.networkToEditIdx,
		nameTerm.value,
		urlTerm.value,
		selectedExplorer.value
	)

	isNetworkUpdateInProgress.value = false
	emit("onClose")
	openToast({ label: "Node is updated" })
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			handleFillFieldsWithDefaultValues()
		} else {
			document.addEventListener("keydown", onKeydown)

			handleFillFieldsWithDefaultValues()
		}
	},
)

const onKeydown = (e) => {
	if (e.key === "Enter") handleUpdateNetwork()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_network?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Edit node</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						size="large"
						:title="networkToEdit.name"
						description="Selected node for editing"
						icon="globe-edit"
						raw
					/>
				</ItemsContainer>

				<Input
					label="New name"
					placeholder="My node"
					v-model="nameTerm"
					autofocus
					sanitize
					:maxLength="25"
					@input="isStartedEditingName = true"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isNameAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exists </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Input
					label="New RPC Link"
					placeholder="http://localhost:8080"
					v-model="urlTerm"
					@input="isStartedEditingUrl = true"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isUrlAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exists </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<!-- Block Explorer Selector (only show if explorers available) -->
				<Flex v-if="hasExplorers" direction="column" gap="8">
					<Text size="13" weight="600" color="secondary">Block Explorer</Text>
					<Dropdown fullWidth>
						<template #trigger>
							<DropdownTrigger wide @click="isStartedEditingExplorer = true">
								<Text size="13" weight="600" color="primary" style="text-transform: capitalize">
									{{ availableExplorers.find(e => e.id === selectedExplorer)?.name }}
								</Text>
								<Icon name="chevron-down" size="12" color="tertiary" />
							</DropdownTrigger>
						</template>

						<template #popup>
							<DropdownItem
								v-for="explorer in availableExplorers"
								:key="explorer.id"
								@click="selectedExplorer = explorer.id; isStartedEditingExplorer = true"
							>
								<Flex align="center" gap="8">
									<Icon
										:name="selectedExplorer === explorer.id ? 'check' : ''"
										size="14"
										color="primary"
									/>
									{{ explorer.name }}
								</Flex>
							</DropdownItem>
						</template>
					</Dropdown>
				</Flex>

				<!-- Placeholder when no explorers available -->
				<Flex v-else direction="column" gap="8">
					<Text size="13" weight="600" color="secondary">Block Explorer</Text>
					<Flex align="center" :style="{ padding: '8px 12px', borderRadius: '8px', background: 'var(--card-bg)' }">
						<Text size="13" weight="600" color="tertiary">None available</Text>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12">
					<Flex direction="column" gap="12">
						<Button
							@click="handleUpdateNetwork"
							wide
							type="primary"
							size="medium"
							:disabled="!isAvailableToUpdateNetwork || (!isStartedEditingName && !isStartedEditingUrl && !isStartedEditingExplorer)"
							:loading="isNetworkUpdateInProgress"
						>
							Update
						</Button>
						<Button @click="handleFillFieldsWithDefaultValues" wide type="secondary" size="medium">
							Reset changes
						</Button>
					</Flex>

					<Text size="12" weight="500" color="tertiary" height="140" align="center" style="padding: 0 20px">
						We will check the availability of the specified RPC before adding it
					</Text>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.network {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.item {
	height: 30px;

	border-radius: 8px;
	box-shadow: inset 0 0 0 2px var(--gray-5);
	cursor: pointer;

	padding: 0 16px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 2px var(--gray-10);
	}

	&:active {
		background: var(--gray-5);
	}

	&.selected {
		background: var(--green);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}
</style>
