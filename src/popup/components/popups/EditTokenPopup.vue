<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import CandidatesForm from "./NewTokenPopup/CandidatesForm.vue"

/** Utils */
import { managers } from "@/utils/core"

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
	return popupStore.len - popupStore.popups.edit_token
})

const props = defineProps({
	show: Boolean,
})

const emit = defineEmits(["onClose"])

// biome-ignore lint/suspicious/noDoubleEquals: <explanation>
const tokenToEdit = computed(() => appStore.tokens.find(t => t.id == cacheStore.tokenToEditIdx))

const isAvailableToUpdateToken = computed(() => {
	return true
})

const rawToken = ref()
const selectedFields = ref({
	balanceOfPrivateFn: null,
	balanceOfPublicFn: null,
	transferPrivateFn: null,
	transferPublicFn: null,
	transferPrivateToPublicFn: null,
	transferPublicToPrivateFn: null,
	getNameFn: null,
	getSymbolFn: null,
	getDecimalsFn: null,
})
const handleSelectCandidate = (target, candidate) => {
	selectedFields.value[target] = candidate
	rawToken.value[target] = candidate
}
const handleResetChanges = () => {
	rawToken.value = { ...tokenToEdit.value }
	selectedFields.value = {}
}

const handleSaveToken = async () => {
	const updatedToken = await managers.token.updateToken(cacheStore.tokenToEditIdx, rawToken.value)

	const updatedTokenIdx = appStore.tokens.findLast(t => t.id == cacheStore.tokenToEditIdx)
	appStore.tokens[updatedTokenIdx] = updatedToken

	await appStore.syncBalances()

	openToast({ label: `${rawToken.value.symbol} is added to tokens` })

	emit("onClose")
}

const isAwaitingTokenInterface = ref(true)
watch(
	() => props.show,
	async () => {
		if (!props.show) {
			rawToken.value = null
			selectedFields.value = {}
			isAwaitingTokenInterface.value = false
		} else {
			isAwaitingTokenInterface.value = true
			const tokenInterface = await managers.token.getInterface(cacheStore.tokenToEditIdx)

			rawToken.value = { ...tokenInterface }

			for (const fieldName of Object.keys(selectedFields.value)) {
				selectedFields.value[fieldName] = rawToken.value[fieldName]
			}

			isAwaitingTokenInterface.value = false
		}
	},
)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_token">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary"> Edit token </Text>

				<Button v-if="isAwaitingTokenInterface" type="secondary" size="medium" disabled loading>
					Loading token interface
				</Button>

				<template v-else>
					<Flex direction="column" gap="8">
						<Text size="12" weight="600" color="primary">
							{{ rawToken.symbol }} <Text color="secondary">{{ rawToken.name }}</Text>
						</Text>
						<Text size="12" weight="600" color="tertiary">
							{{ rawToken.contract.slice(0, 6) }} ••• {{ rawToken.contract.slice(-4) }}
						</Text>
					</Flex>

					<CandidatesForm :selectedFields @onFieldSelect="handleSelectCandidate" :token="rawToken" />

					<Flex gap="8">
						<Button
							@click="handleResetChanges"
							wide
							type="secondary"
							size="medium"
							:disabled="!Object.keys(selectedFields).length"
						>
							Reset changes
						</Button>
						<Button
							@click="handleSaveToken"
							wide
							type="primary"
							size="medium"
							:disabled="!isAvailableToUpdateToken"
						>
							<Text color="inverse">Update token</Text>
						</Button>
					</Flex>
				</template>
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
