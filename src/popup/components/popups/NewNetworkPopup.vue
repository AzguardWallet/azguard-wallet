<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.new_network?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const notAllowedNetworkNames = computed(() => appStore.networks.map(n => n.name))

const nameTerm = ref("")
const urlTerm = ref("https://rpc.sandbox.azguardwallet.io/")

const isUrlHasError = ref(false)

const isAlreadyExist = computed(() => notAllowedNetworkNames.value.includes(nameTerm.value))
const isAvailableToCreateNetwork = computed(() => {
	if (!nameTerm.value.length) return
	if (!urlTerm.value.length) return
	if (urlTerm.value.length < 5) return
	if (isAlreadyExist.value) return

	return true
})

const isCreating = ref(false)
const handleCreateNetwork = async () => {
	if (!isAvailableToCreateNetwork.value) return

	try {
		isCreating.value = true
		const network = await managers.network.addNetwork(nameTerm.value, urlTerm.value)
		isCreating.value = false

		/** todo: ref */
		appStore.network = network
		managers.network.setDefault(appStore.network.id)
		chrome.storage.local.set({ "azguard:ui:activeNetwork": appStore.network.id })

		appStore.networks = await managers.network.getNetworks()

		emit("onClose")

		openToast({ label: "Node is created" })
	} catch (error) {
		isCreating.value = false

		if (error === "failed to fetch node info") {
			isUrlHasError.value = true
		} else {
			openToast({ label: "Something went wrong", icon: "warning" })
		}
	}
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			nameTerm.value = ""
			urlTerm.value = "https://rpc.sandbox.azguardwallet.io/"
		} else {
			document.addEventListener("keydown", onKeydown)
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleCreateNetwork()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_network?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New node</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Input label="Name" placeholder="My node" v-model="nameTerm" autofocus>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Input
					label="RPC Link"
					placeholder="http://localhost:1337"
					v-model="urlTerm"
					@click="isUrlHasError = false"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isUrlHasError" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Failed to fetch node info </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="12">
					<Button
						@click="handleCreateNetwork"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToCreateNetwork"
						:loading="isCreating"
					>
						Create
					</Button>

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
