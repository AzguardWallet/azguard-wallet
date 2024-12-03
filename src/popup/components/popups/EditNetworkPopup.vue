<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

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
	return popupStore.len - popupStore.popups.edit_network
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const networkToEdit = computed(() =>
	appStore.networks.find((n) => n.id === cacheStore.networkToEditIdx)
)

const notAllowedNetworkNames = computed(() =>
	appStore.networks.map((n) => n.name)
)

const nameTerm = ref("")
const urlTerm = ref("")
const handleFillFieldsWithDefaultValues = () => {
	nameTerm.value = networkToEdit.value.name
	urlTerm.value = networkToEdit.value.rpcUrl
}

const isAlreadyExist = computed(() =>
	notAllowedNetworkNames.value.includes(nameTerm.value)
)
const isAvailableToUpdateNetwork = computed(() => {
	if (!nameTerm.value.length) return
	if (!urlTerm.value.length) return
	if (urlTerm.value.length < 5) return
	if (isAlreadyExist.value) return

	return true
})

const isNetworkUpdateInProgress = ref(false)
const handleUpdateNetwork = async () => {
	if (!isAvailableToUpdateNetwork.value) return

	isNetworkUpdateInProgress.value = true
	await appStore.updateNetwork(
		cacheStore.networkToEditIdx,
		nameTerm.value,
		urlTerm.value
	)
	isNetworkUpdateInProgress.value = false

	emit("onClose")

	openToast({ label: "Network is updated" })
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
	}
)

const onKeydown = (e) => {
	if (e.code === "Enter") handleCreateNetwork()
}
</script>

<template>
	<Popup
		:show
		@onClose="emit('onClose')"
		:displaceIdx="popupStore.popups.edit_network"
	>
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary">
					Edit network
				</Text>

				<Input
					label="New name"
					placeholder="My Network"
					v-model="nameTerm"
					autofocus
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary">
									Already exist
								</Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Input
					label="New RPC Link"
					placeholder="http://localhost:1337"
					v-model="urlTerm"
				/>

				<Flex direction="column" gap="12">
					<Button
						@click="handleUpdateNetwork"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToUpdateNetwork"
						:loading="isNetworkUpdateInProgress"
					>
						<Text color="inverse">Update</Text>
					</Button>
					<Button
						@click="handleFillFieldsWithDefaultValues"
						wide
						type="secondary"
						size="medium"
					>
						Reset changes
					</Button>
				</Flex>

				<Text
					size="12"
					weight="500"
					color="tertiary"
					height="140"
					align="center"
				>
					We will check the availability of the specified RPC before
					adding it
				</Text>
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
