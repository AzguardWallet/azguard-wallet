<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import CandidatesForm from "./CandidatesForm.vue"

/** Utils */
import { managers } from "@/utils/core"
import { isValidHex } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.new_token?.order
})

const props = defineProps({
	show: Boolean,
})

const emit = defineEmits(["onClose"])

const contractAddressTerm = ref("")

const isLoadingParseResult = ref(false)
const isAddingNewToken = ref(false)

const tokens = ref([])
const isAlreadyExist = computed(() => tokens.value?.findLast(t => t.contract === contractAddressTerm.value))
const isAvailableToCreateToken = computed(() => {
	if (!isValidHex(contractAddressTerm.value)) return
	// if (isLoadingParseResult.value) return
	if (isAlreadyExist.value) return

	return true
})

const isCompleted = ref(true)
const rawToken = ref()
const rawTokenForReset = ref()
const selectedFields = ref({})
const availableFields = [
	"balanceOfPrivateFn",
	"balanceOfPublicFn",
	"transferPrivateFn",
	"transferPublicFn",
	"transferPrivateToPublicFn",
	"transferPublicToPrivateFn",
	"getNameFn",
	"getSymbolFn",
	"getDecimalsFn",
]
const handleSelectCandidate = (target, candidate) => {
	selectedFields.value[target] = candidate
	rawToken.value[target] = candidate
}
const handleClearCandidate = target => {
	delete selectedFields.value[target]
	rawToken.value[target] = null
}
const handleResetChanges = () => {
	rawToken.value = { ...rawTokenForReset.value }
	selectedFields.value = {}
}

const error = ref()
const isErrorOccurred = computed(() => !!error.value)

const handleCreateToken = async () => {
	if (!isAvailableToCreateToken.value) return

	isLoadingParseResult.value = true

	try {
		const parsingResult = await managers.token.parseInterface(contractAddressTerm.value)

		if (!parsingResult.isComplete) {
			isLoadingParseResult.value = false

			isCompleted.value = false
			rawToken.value = { ...parsingResult }
			rawTokenForReset.value = { ...parsingResult }

			for (const fieldName of availableFields) {
				if (rawToken.value[fieldName]) {
					selectedFields.value[fieldName] = rawToken.value[fieldName]
				}
			}

			return
		}

		isAddingNewToken.value = true
		isLoadingParseResult.value = false

		if (!parsingResult.isComplete) {
			openToast({ label: "Something went wrong", icon: "close-circle" })
			return
		}

		await managers.token.addToken(parsingResult)

		isAddingNewToken.value = false

		await appStore.syncBalances()

		openToast({ label: "New token has been added" })

		emit("onClose")
	} catch (err) {
		error.value = err

		isAddingNewToken.value = false
		isLoadingParseResult.value = false
	}
}

const isSavingToken = ref(false)
const handleSaveToken = async () => {
	isSavingToken.value = true

	try {
		await managers.token.addToken(rawToken.value)

		await appStore.syncBalances()

		openToast({ label: "New token has been added" })
	} catch (err) {
		error.value = err
	} finally {
		isSavingToken.value = false
	}

	cacheStore.preselectedTokenAddressToAdd = ""
	emit("onClose")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			contractAddressTerm.value = ""

			isCompleted.value = true

			selectedFields.value = {}

			error.value = null
		} else {
			const rawTokens = await managers.token?.getTokens()
			tokens.value = rawTokens?.length ? rawTokens.filter(t => t.chainId === appStore.network.chainId) : []

			if (cacheStore.preselectedTokenAddressToAdd) {
				contractAddressTerm.value = cacheStore.preselectedTokenAddressToAdd
			}
		}
	},
)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_token?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New token</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Input
					v-model="contractAddressTerm"
					@click="error = null"
					label="Contract address"
					placeholder="0x"
					autofocus
					:disabled="isLoadingParseResult || !isCompleted || isAddingNewToken"
				>
					<template #suffix>
						<Icon v-if="isAvailableToCreateToken" name="check-circle" size="14" color="green" />
					</template>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="4">
								<Icon name="warning" size="12" color="orange" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<CandidatesForm
					v-if="!isCompleted"
					:selectedFields
					@onFieldSelect="handleSelectCandidate"
					@onFieldClear="handleClearCandidate"
					:token="rawToken"
				/>

				<Flex direction="column" align="center" gap="12">
					<Button
						v-if="isCompleted"
						@click="handleCreateToken"
						wide
						:type="isLoadingParseResult || isAddingNewToken ? 'secondary' : 'primary'"
						size="medium"
						:loading="isLoadingParseResult || isAddingNewToken"
						:disabled="!isAvailableToCreateToken || isLoadingParseResult || isAddingNewToken"
					>
						{{
							(isLoadingParseResult && "Awaiting token interface") ||
							(isAddingNewToken && "Adding new token") ||
							"Import new token"
						}}
					</Button>
					<Button
						v-else
						@click="handleSaveToken"
						wide
						type="primary"
						size="medium"
						:loading="isSavingToken"
						:disabled="!isAvailableToCreateToken"
					>
						{{ isSavingToken ? "Saving" : "Save new token" }}
					</Button>
					<Button
						v-if="!isCompleted"
						@click="handleResetChanges"
						wide
						type="secondary"
						size="medium"
						:disabled="!Object.keys(selectedFields).length"
					>
						Reset changes
					</Button>

					<Tooltip v-if="isErrorOccurred" side="top">
						<Flex align="center" gap="6">
							<Icon name="info" size="12" color="red" />
							<Text size="12" weight="500" color="secondary">
								Error occurred while importing a new token
							</Text>
						</Flex>

						<template #content> {{ error }} </template>
					</Tooltip>
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
