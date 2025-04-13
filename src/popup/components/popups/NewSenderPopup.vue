<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { isValidHex } from "@/utils/string"

/** Services */
import { AccountStateServiceClient } from "@/wallet/services/account-state/client"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.new_sender
})


let accountStateClientService = null
const senderAddress = ref("")
const isLoading = ref(false)
const error = ref("")

const isAvailableToAddSender = computed(() => {
	if (!senderAddress.value.length) return
	if (!isValidHex(senderAddress.value)) return

	return true
})

const handleAddSender = async () => {
	if (!isAvailableToAddSender.value) return

	isLoading.value = true

	try {
		await accountStateClientService.addSender(appStore.network.id, senderAddress.value)
		emit("onClose")
		openToast({ label: "Sender is added" })
	} catch (err) {
		error.value = err
	} finally {
		isLoading.value = false
	}
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			accountStateClientService.dispose()
			accountStateClientService = null
			senderAddress.value = ""
		} else {
			accountStateClientService = new AccountStateServiceClient()

			document.addEventListener("keydown", onKeydown)
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleAddSender()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_sender">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New sender</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Input
					v-model="senderAddress"
					label="Sender address"
					placeholder="0x174403baa8cd5ad87b6bc5b6db32eb430c77cae5798092c4e4755835bb4d0cb0"
					autofocus
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="!isAvailableToAddSender && senderAddress" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Invalid address </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="10">
					<Transition name="fade">
						<Tooltip
							v-if="error"
							side="top"
							position="start"
							wide
							:style="{ marginTop: '-12px' }"
						>
							<Flex align="center" gap="6">
								<Icon
									name="info"
									size="14"
									color="red"
								/>

								<Text size="12" weight="600" color="secondary">
									Failed to add sender
								</Text>
							</Flex>

							<template #content>
								<Text size="12" color="secondary">
									{{ error }}
								</Text>
							</template>
						</Tooltip>
					</Transition>
					
					<Button
						@click="handleAddSender"
						wide
						type="primary"
						size="medium"
						:loading="isLoading"
						:class="error && $style.shake"
						:disabled="!isAvailableToAddSender || !senderAddress"
					>
						Add sender
					</Button>
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

.shake {
	animation: shake 0.5s ease;
}

@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	25% {
		transform: translateX(-2px);
	}
	50% {
		transform: translateX(2px);
	}
	75% {
		transform: translateX(-2px);
	}
}
</style>
