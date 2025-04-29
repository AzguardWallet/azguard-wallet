<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { debounce } from "@/utils/general"
import { isValidHex } from "@/utils/string"
import { isValidAmount } from "@/utils/amount"

/** Store */
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
	payload: Object,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.edit_claim_parameters?.order
})

const claimParameters = ref()
const claimAmount = ref()
const claimSecret = ref()
const messageLeafIndex = ref()

const error = ref({ sources: [] })

function addError(source) {
	if (!error.value.sources.includes(source)) {
		error.value.sources.push(source)
	}
}

function removeError(source) {
	error.value.sources = error.value.sources.filter(f => f !== source)
}

const validateClaimAmount = debounce(() => {
	removeError('claimAmount');
	if (!claimAmount.value) return

	if (isValidAmount(claimAmount.value) || isValidHex(claimAmount.value)) return

	addError('claimAmount');
}, 500);

const validateClaimSecret = debounce(() => {
	removeError('claimSecret');
	if (!claimSecret.value) return

	if (!isValidHex(claimSecret.value)) {
		addError('claimSecret');
	}
}, 500);

const validateMessageLeafIndex = debounce(() => {
	removeError('messageLeafIndex');
	if (!messageLeafIndex.value) return

	if (isValidAmount(messageLeafIndex.value) || isValidHex(messageLeafIndex.value)) return

	addError('messageLeafIndex');
}, 500);

const handleUpdateParameters = async () => {
	if (error.value.sources.length) return

	const methodIx = cacheStore.feePaymentMethods.findIndex(m => m.id === props.payload?.id)
	if (methodIx === -1) {
		cacheStore.feePaymentMethods.push({
			id: props.payload?.id,
			claimParameters: {
				claimAmount: claimAmount.value,
				claimSecret: claimSecret.value,
				messageLeafIndex: messageLeafIndex.value,
			},
		})
	} else {
		cacheStore.feePaymentMethods[methodIx].claimParameters = {
			claimAmount: claimAmount.value,
			claimSecret: claimSecret.value,
			messageLeafIndex: messageLeafIndex.value,
		}
	}

	emit("onClose")
}

const handleCancel = () => {
	emit("onClose")
}

watch(
	() => claimAmount.value,
	() => validateClaimAmount()
)
watch(
	() => claimSecret.value,
	() => {
		validateClaimSecret()
	}
)
watch(
	() => messageLeafIndex.value,
	() => validateMessageLeafIndex()
)
watch(
	() => props.show,
	() => {
		if (!props.show) {
			claimParameters.value = null

			document.removeEventListener("keydown", onKeydown)
		} else {
			claimParameters.value = cacheStore.feePaymentMethods.find(m => m.id === props.payload?.id)?.claimParameters
			claimAmount.value = claimParameters.value?.claimAmount
			claimSecret.value = claimParameters.value?.claimSecret
			messageLeafIndex.value = claimParameters.value?.messageLeafIndex

			document.addEventListener("keydown", onKeydown)
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleUpdateParameters()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_claim_parameters?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Edit claim parameters</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Input
					label="Claim amount"
					placeholder="Enter claim amount"
					v-model="claimAmount"
					autofocus
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="error.sources?.includes('claimAmount')" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Invalid amount </Text>
							</Flex>
						</Transition>
					</template>
				</Input>
				<Input
					label="Claim secret"
					placeholder="Enter claim secret"
					v-model="claimSecret"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="error.sources?.includes('claimSecret')" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Invalid secret </Text>
							</Flex>
						</Transition>
					</template>
				</Input>
				<Input
					label="Message leaf index"
					placeholder="Enter message leaf index"
					v-model="messageLeafIndex"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="error.sources?.includes('messageLeafIndex')" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Invalid message leaf index </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="12">
					<Button
						@click="handleUpdateParameters"
						wide
						type="primary"
						size="medium"
						:disabled="!(error.sources.length === 0 && claimAmount && claimSecret && messageLeafIndex)"
					>
						Update Parameters
					</Button>
					<Button @click="handleCancel" wide type="secondary" size="medium">
						Cancel
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
</style>
